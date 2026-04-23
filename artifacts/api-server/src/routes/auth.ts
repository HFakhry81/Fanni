import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { signOtpToken, verifyOtpToken, OTP_ENABLED } from "../lib/otp";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
  SetUserRoleBody,
} from "@workspace/api-zod";
import { db, usersTable, adminsTable, passwordResetTokensTable, phoneVerificationsTable, loginLogsTable } from "@workspace/db";
import { eq, and, gt, isNull, lt, desc } from "drizzle-orm";
import { sendPasswordResetCode, sendWelcomeEmail } from "../lib/email";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  SessionData,
} from "../lib/auth";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return true;
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [key, ts] of rateLimitStore) {
      const pruned = ts.filter((t) => t > cutoff);
      if (pruned.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, pruned);
    }
  }, 5 * 60 * 1000);
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

function buildAuthUser(dbUser: typeof usersTable.$inferSelect) {
  return {
    id: dbUser.id,
    email: dbUser.email ?? null,
    firstName: dbUser.firstName ?? null,
    lastName: dbUser.lastName ?? null,
    profileImageUrl: dbUser.profileImageUrl ?? null,
    role: dbUser.role ?? null,
    mobile: dbUser.mobile ?? null,
    governorate: dbUser.governorate ?? null,
    area: dbUser.area ?? null,
    district: dbUser.district ?? null,
    profession: dbUser.profession ?? null,
    specialty: dbUser.specialty ?? null,
    serviceCategories: (dbUser.serviceCategories as string[] | null) ?? null,
  };
}

function buildAdminUser(admin: typeof adminsTable.$inferSelect) {
  return {
    id: admin.id,
    email: admin.email ?? null,
    firstName: admin.firstName ?? null,
    lastName: admin.lastName ?? null,
    profileImageUrl: null,
    role: "admin" as const,
    mobile: admin.mobile ?? null,
    governorate: null,
    area: null,
    district: null,
    profession: null,
    specialty: null,
  };
}

// PUBLIC: Returns the current user if authenticated, or { user: null } if not.
// Intentionally allows unauthenticated access so clients can check login state.
router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }
  if (req.sessionSource === "admin") {
    const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.id, req.user.id));
    res.json(GetCurrentAuthUserResponse.parse({ user: admin ? buildAdminUser(admin) : null }));
    return;
  }
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!dbUser) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }
  res.json(GetCurrentAuthUserResponse.parse({ user: buildAuthUser(dbUser) }));
});

router.post("/auth/role", authMiddleware, requireAuth, async (req: Request, res: Response) => {
  // Admin sessions cannot change roles via this endpoint
  if (req.sessionSource === "admin") {
    res.status(403).json({ error: "Admin role cannot be modified via this endpoint" });
    return;
  }
  const parsed = SetUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  // Admin role can only be assigned via the admins table — block it here
  if (parsed.data.role === "admin") {
    res.status(403).json({ error: "Admin role cannot be assigned via this endpoint" });
    return;
  }
  const [dbUser] = await db
    .update(usersTable)
    .set({ role: parsed.data.role as "client" | "technician", updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id))
    .returning();
  if (!dbUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetCurrentAuthUserResponse.parse({ user: buildAuthUser(dbUser) }));
});

// PUBLIC: Initiates the OIDC login flow. No auth required.
router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });
  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);
  res.redirect(redirectTo.href);
});

// PUBLIC: OIDC authorization code callback. No auth required.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;
  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }
  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );
  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }
  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });
  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }
  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: buildAuthUser(dbUser),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

// PUBLIC: Ends the session and redirects to the OIDC logout endpoint. No auth required.
router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const sid = getSessionId(req);
  await clearSession(res, sid);
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });
  res.redirect(endSessionUrl.href);
});

// PUBLIC: Exchanges a mobile OIDC authorization code for a session token. No auth required.
router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }
  const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;
  try {
    const config = await getOidcConfig();
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", ISSUER_URL);
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: nonce ?? undefined,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) {
      res.status(401).json({ error: "No claims in ID token" });
      return;
    }
    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: buildAuthUser(dbUser),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    };
    const sid = await createSession(sessionData);
    res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
  } catch (err) {
    req.log.error({ err }, "Mobile token exchange error");
    res.status(500).json({ error: "Token exchange failed" });
  }
});

// PUBLIC: Deletes a mobile session (logout). No auth required — the token is supplied in the request body.
router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
}

function hashResetCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(`otp:${code}`).digest("hex");
}

async function sendSmsOtp(mobile: string, code: string): Promise<boolean> {
  if (!process.env.SMS_API_KEY) {
    console.log(`[OTP] SMS not configured. Code for ${mobile}: ${code}`);
    return false;
  }
  return false;
}

// PUBLIC: Returns feature flags relevant to the mobile client.
router.get("/config", (_req: Request, res: Response) => {
  res.json({ otpEnabled: OTP_ENABLED });
});

// PUBLIC: Sends a 6-digit OTP to a mobile number. No auth required.
router.post("/auth/send-otp", async (req: Request, res: Response) => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile || !EGYPT_MOBILE_RE.test(mobile.trim().replace(/\s|-/g, ""))) {
    res.status(400).json({ error: "Valid Egyptian mobile number is required" });
    return;
  }
  const mobileDigits = mobile.trim().replace(/\s|-/g, "");
  const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
  const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`otp-send:ip:${ip}`, 5, 10 * 60 * 1000) || !checkRateLimit(`otp-send:mobile:${normalizedMobile}`, 3, 10 * 60 * 1000)) {
    res.status(429).json({ error: "Too many OTP requests. Please wait before trying again." });
    return;
  }

  const code = String(crypto.randomInt(100_000, 1_000_000));
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(phoneVerificationsTable).values({ mobile: normalizedMobile, codeHash, expiresAt });
  await sendSmsOtp(normalizedMobile, code);
  req.log.info({ mobile: normalizedMobile }, "OTP sent");
  res.json({ success: true });
});

// PUBLIC: Verifies a 6-digit OTP and returns a short-lived verification token. No auth required.
router.post("/auth/verify-otp", async (req: Request, res: Response) => {
  const { mobile, code } = req.body as { mobile?: string; code?: string };
  if (!mobile || !code) {
    res.status(400).json({ error: "mobile and code are required" });
    return;
  }
  const mobileDigits = mobile.trim().replace(/\s|-/g, "");
  const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
  const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`otp-verify:ip:${ip}`, 10, 10 * 60 * 1000) || !checkRateLimit(`otp-verify:mobile:${normalizedMobile}`, 5, 10 * 60 * 1000)) {
    res.status(429).json({ error: "Too many verification attempts. Please wait." });
    return;
  }

  const codeHash = hashOtpCode(code.trim());
  const now = new Date();

  const [record] = await db
    .select()
    .from(phoneVerificationsTable)
    .where(
      and(
        eq(phoneVerificationsTable.mobile, normalizedMobile),
        eq(phoneVerificationsTable.codeHash, codeHash),
        gt(phoneVerificationsTable.expiresAt, now),
        isNull(phoneVerificationsTable.usedAt),
      ),
    )
    .orderBy(desc(phoneVerificationsTable.createdAt))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db
    .update(phoneVerificationsTable)
    .set({ usedAt: now })
    .where(eq(phoneVerificationsTable.id, record.id));

  const verificationToken = signOtpToken(normalizedMobile);
  req.log.info({ mobile: normalizedMobile }, "OTP verified");
  res.json({ verificationToken });
});

// PUBLIC: Sends a password reset code. No auth required — used for account recovery.
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const { identifier } = req.body as { identifier?: string };
  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    res.status(400).json({ error: "Email or mobile number is required" });
    return;
  }

  const needle = identifier.trim().toLowerCase();

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`forgot:ip:${ip}`, 5, 60 * 60 * 1000) || !checkRateLimit(`forgot:id:${needle}`, 3, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many requests. Please wait before trying again." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      needle.includes("@") ? eq(usersTable.email, needle) : eq(usersTable.mobile, needle),
    );

  if (!user) {
    res.json({ success: true });
    return;
  }

  const code = String(crypto.randomInt(100_000, 1_000_000));
  const tokenHash = hashResetCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  req.log.info({ userId: user.id }, "Password reset requested");

  const destination = user.email ?? user.mobile;
  if (destination) {
    const sent = await sendPasswordResetCode({ to: destination, code });
    if (!sent) {
      console.warn(`[PASSWORD RESET] Email not sent (SMTP unconfigured). Configure SMTP_HOST/SMTP_USER/SMTP_PASS to enable email delivery.`);
    }
  }

  res.json({ success: true });
});

// PUBLIC: Resets a user's password using a valid reset code. No auth required.
router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const { identifier, code, newPassword } = req.body as {
    identifier?: string;
    code?: string;
    newPassword?: string;
  };

  if (!identifier || !code || !newPassword) {
    res.status(400).json({ error: "identifier, code and newPassword are required" });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const needle = identifier.trim().toLowerCase();

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`reset:ip:${ip}`, 10, 60 * 60 * 1000) || !checkRateLimit(`reset:id:${needle}`, 5, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many attempts. Please wait before trying again." });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      needle.includes("@") ? eq(usersTable.email, needle) : eq(usersTable.mobile, needle),
    );

  if (!user) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  const tokenHash = hashResetCode(code.trim());
  const now = new Date();

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        gt(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  if (!resetToken) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: now })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  const salt = generateSalt();
  const passwordHash = `${salt}:${hashPassword(newPassword, salt)}`;

  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: now })
    .where(eq(usersTable.id, user.id));

  req.log.info({ userId: user.id }, "Password reset successful");
  res.json({ success: true });
});

const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

// PUBLIC: Checks whether a mobile number or email is already registered. No auth required.
router.post("/auth/check-availability", async (req: Request, res: Response) => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`check-availability:ip:${ip}`, 20, 60 * 1000)) {
    res.status(429).json({ error: "Too many requests, please wait before trying again." });
    return;
  }

  const { mobile, email } = req.body as { mobile?: string; email?: string };

  const result: { mobileTaken: boolean; emailTaken: boolean } = {
    mobileTaken: false,
    emailTaken: false,
  };

  if (mobile && mobile.trim()) {
    const mobileDigits = mobile.trim().replace(/\s|-/g, "");
    const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
    const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;
    const [[existingUser], [existingAdmin]] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.mobile, normalizedMobile)),
      db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.mobile, normalizedMobile)),
    ]);
    result.mobileTaken = !!(existingUser || existingAdmin);
  }

  if (email && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    const [[existingUser], [existingAdmin]] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)),
      db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, normalizedEmail)),
    ]);
    result.emailTaken = !!(existingUser || existingAdmin);
  }

  res.json(result);
});

// PUBLIC: Registers a new user account and returns a session token. No auth required.
router.post("/auth/register", async (req: Request, res: Response) => {
  const { name, email, mobile, password, role, nationalId, governorateId, areaId, verificationToken, serviceCategories } = req.body as {
    name?: string;
    email?: string;
    mobile?: string;
    password?: string;
    role?: string;
    nationalId?: string;
    governorateId?: string;
    areaId?: string;
    verificationToken?: string;
    serviceCategories?: string[];
  };

  if (!name || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!mobile || !mobile.trim()) {
    res.status(400).json({ error: "Mobile number is required" });
    return;
  }
  if (!EGYPT_MOBILE_RE.test(mobile.trim().replace(/\s|-/g, ""))) {
    res.status(400).json({ error: "Invalid Egyptian mobile number" });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    res.status(400).json({ error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character" });
    return;
  }
  if (role && !["client", "technician"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  // OTP gate: when ENABLE_OTP=true, verificationToken is mandatory and must match the mobile number
  if (OTP_ENABLED) {
    if (!verificationToken) {
      res.status(400).json({ error: "Phone verification is required. Please verify your mobile number first." });
      return;
    }
    const mobileForOtp = mobile.trim().replace(/\s|-/g, "");
    const mobileMatchOtp = mobileForOtp.match(EGYPT_MOBILE_RE);
    const normalizedForOtp = mobileMatchOtp ? `0${mobileMatchOtp[2]}` : mobileForOtp;
    const tokenMobile = verifyOtpToken(verificationToken);
    if (!tokenMobile || tokenMobile !== normalizedForOtp) {
      res.status(400).json({ error: "Phone verification failed. Please verify your mobile number and try again." });
      return;
    }
  }

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many registration attempts. Please wait before trying again." });
    return;
  }

  const mobileDigits = mobile.trim().replace(/\s|-/g, "");
  const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
  const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;

  const [[existingUserMobile], [existingAdminMobile]] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.mobile, normalizedMobile)),
    db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.mobile, normalizedMobile)),
  ]);
  if (existingUserMobile || existingAdminMobile) {
    res.status(409).json({ error: "Mobile number is already registered" });
    return;
  }

  if (email && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    const [[existingUserEmail], [existingAdminEmail]] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)),
      db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, normalizedEmail)),
    ]);
    if (existingUserEmail || existingAdminEmail) {
      res.status(409).json({ error: "Email address is already registered" });
      return;
    }
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);
  const passwordHash = `${salt}:${hashedPassword}`;

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? name.trim();
  const lastName = nameParts.slice(1).join(" ") || null;

  const [newUser] = await db
    .insert(usersTable)
    .values({
      email: email ? email.trim().toLowerCase() : null,
      firstName,
      lastName,
      mobile: normalizedMobile,
      role: (role as "client" | "technician") ?? "client",
      passwordHash,
      governorate: governorateId ?? null,
      area: areaId ?? null,
      serviceCategories: (Array.isArray(serviceCategories) && serviceCategories.length > 0) ? serviceCategories : null,
    })
    .returning();

  if (!newUser) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const sessionData: SessionData = {
    user: buildAuthUser(newUser),
    source: "user",
    access_token: "",
    refresh_token: undefined,
    expires_at: undefined,
  };
  const sid = await createSession(sessionData);
  req.log.info({ userId: newUser.id }, "New user registered");

  if (newUser.email) {
    sendWelcomeEmail({
      to: newUser.email,
      name: name.trim(),
      role: (role as "client" | "technician") ?? "client",
    }).catch((err) => req.log.warn({ err }, "Welcome email failed to send"));
  }

  res.status(201).json({ token: sid, user: buildAuthUser(newUser) });
});

// PUBLIC: Authenticates with mobile/email + password credentials. No auth required.
// Checks the admins table first, then falls through to users.
router.post("/auth/login-with-password", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as {
    identifier?: string;
    password?: string;
  };

  if (!identifier || !password) {
    res.status(400).json({ error: "identifier and password are required" });
    return;
  }

  const needle = identifier.trim().toLowerCase();
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
  const userAgent = String(req.headers["user-agent"] ?? "");

  async function logLoginAttempt(opts: {
    userId?: string;
    role?: string;
    success: boolean;
    failureReason?: string;
  }) {
    try {
      await db.insert(loginLogsTable).values({
        userId: opts.userId ?? null,
        identifier: needle,
        role: opts.role ?? null,
        success: opts.success,
        failureReason: opts.failureReason ?? null,
        ipAddress: ip,
        userAgent: userAgent.slice(0, 500),
      });
    } catch (e) {
      req.log.warn({ err: e }, "Failed to write login log");
    }
  }

  if (!checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000) || !checkRateLimit(`login:id:${needle}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: "Too many login attempts. Please wait before trying again." });
    return;
  }

  // Check admins table first
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(
      needle.includes("@") ? eq(adminsTable.email, needle) : eq(adminsTable.mobile, needle),
    );

  if (admin) {
    if (!admin.passwordHash || !verifyPassword(password, admin.passwordHash)) {
      await logLoginAttempt({ userId: admin.id, role: "admin", success: false, failureReason: "invalid_password" });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (!admin.isActive) {
      await logLoginAttempt({ userId: admin.id, role: "admin", success: false, failureReason: "account_suspended" });
      res.status(403).json({ error: "Account is suspended" });
      return;
    }
    const authUser = buildAdminUser(admin);
    const sessionData: SessionData = {
      user: authUser,
      source: "admin",
      access_token: "",
      refresh_token: undefined,
      expires_at: undefined,
    };
    const sid = await createSession(sessionData);
    await logLoginAttempt({ userId: admin.id, role: "admin", success: true });
    req.log.info({ adminId: admin.id }, "Admin signed in with password");
    res.json({ token: sid, user: authUser });
    return;
  }

  // Fall through to users table
  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      needle.includes("@") ? eq(usersTable.email, needle) : eq(usersTable.mobile, needle),
    );

  if (!user || !user.passwordHash) {
    await logLoginAttempt({ success: false, failureReason: "user_not_found" });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    await logLoginAttempt({ userId: user.id, role: user.role ?? "client", success: false, failureReason: "invalid_password" });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    await logLoginAttempt({ userId: user.id, role: user.role ?? "client", success: false, failureReason: "account_suspended" });
    res.status(403).json({ error: "Account is suspended" });
    return;
  }

  const sessionData: SessionData = {
    user: buildAuthUser(user),
    source: "user",
    access_token: "",
    refresh_token: undefined,
    expires_at: undefined,
  };
  const sid = await createSession(sessionData);
  await logLoginAttempt({ userId: user.id, role: user.role ?? "client", success: true });
  req.log.info({ userId: user.id }, "User signed in with password");
  res.json({ token: sid, user: buildAuthUser(user) });
});

// PROTECTED: Updates the current user's profile. Mobile and role are immutable.
router.patch("/auth/me", authMiddleware, requireAuth, async (req: Request, res: Response) => {
  const { firstName, lastName, email, specialty, governorate, area, district, serviceCategories } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    specialty?: string | null;
    governorate?: string | null;
    area?: string | null;
    district?: string | null;
    serviceCategories?: string[] | null;
  };

  const now = new Date();

  // Validate common fields
  let firstNameVal: string | undefined;
  let lastNameVal: string | null | undefined;
  let emailVal: string | null | undefined;

  if (firstName !== undefined) {
    if (typeof firstName !== "string" || !firstName.trim()) {
      res.status(400).json({ error: "firstName cannot be empty" });
      return;
    }
    firstNameVal = firstName.trim();
  }

  if (lastName !== undefined) {
    lastNameVal = lastName === null || lastName === "" ? null : String(lastName).trim() || null;
  }

  if (email !== undefined) {
    if (email === null || email === "") {
      emailVal = null;
    } else {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        res.status(400).json({ error: "Invalid email address" });
        return;
      }
      emailVal = normalizedEmail;
    }
  }

  if (serviceCategories !== undefined && serviceCategories !== null) {
    if (!Array.isArray(serviceCategories) || !serviceCategories.every((c) => typeof c === "string")) {
      res.status(400).json({ error: "serviceCategories must be an array of strings" });
      return;
    }
  }

  // Route update to the correct table using session source (not role claim alone)
  if (req.sessionSource === "admin") {
    // Check email uniqueness across both tables to prevent credential collision
    if (emailVal) {
      const [[adminWithEmail], [userWithEmail]] = await Promise.all([
        db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, emailVal)),
        db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailVal)),
      ]);
      if ((adminWithEmail && adminWithEmail.id !== req.user!.id) || userWithEmail) {
        res.status(409).json({ error: "Email address is already in use" });
        return;
      }
    }

    const adminUpdates: Partial<typeof adminsTable.$inferInsert> & { updatedAt: Date } = { updatedAt: now };
    if (firstNameVal !== undefined) adminUpdates.firstName = firstNameVal;
    if (lastNameVal !== undefined) adminUpdates.lastName = lastNameVal;
    if (emailVal !== undefined) adminUpdates.email = emailVal;

    const [updatedAdmin] = await db
      .update(adminsTable)
      .set(adminUpdates)
      .where(eq(adminsTable.id, req.user!.id))
      .returning();

    res.json({ user: buildAdminUser(updatedAdmin) });
    return;
  }

  // Regular user update
  if (emailVal) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, emailVal));
    if (existing && existing.id !== req.user!.id) {
      res.status(409).json({ error: "Email address is already in use" });
      return;
    }
  }

  const updates: Partial<typeof usersTable.$inferInsert> & { updatedAt: Date } = { updatedAt: now };
  if (firstNameVal !== undefined) updates.firstName = firstNameVal;
  if (lastNameVal !== undefined) updates.lastName = lastNameVal;
  if (emailVal !== undefined) updates.email = emailVal;
  if (specialty !== undefined) updates.specialty = specialty ?? null;
  if (governorate !== undefined) updates.governorate = governorate ?? null;
  if (area !== undefined) updates.area = area ?? null;
  if (district !== undefined) updates.district = district ?? null;
  if (serviceCategories !== undefined) updates.serviceCategories = serviceCategories ?? null;

  const [updatedUser] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({ user: buildAuthUser(updatedUser) });
});

export default router;
