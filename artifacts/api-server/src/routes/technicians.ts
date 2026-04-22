import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.patch(
  "/technicians/:id/availability",
  authMiddleware,
  requireAuth,
  async (req, res) => {
    const { id } = req.params;

    if (req.user.id !== id) {
      res.status(403).json({ error: "Forbidden: cannot update another technician's availability" });
      return;
    }

    const { isAvailable } = req.body as { isAvailable?: unknown };
    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ error: "Invalid body: isAvailable (boolean) is required" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, isAvailable: usersTable.isAvailable });

    if (!updated) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    res.json({ success: true, id: updated.id, isAvailable: updated.isAvailable });
  },
);

router.get("/technicians/available", authMiddleware, requireAuth, async (req, res) => {
  const technicians = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      governorate: usersTable.governorate,
      area: usersTable.area,
      profession: usersTable.profession,
      specialty: usersTable.specialty,
      isAvailable: usersTable.isAvailable,
    })
    .from(usersTable)
    .where(and(eq(usersTable.role, "technician"), eq(usersTable.isAvailable, true)));

  res.json({ technicians });
});

export default router;
