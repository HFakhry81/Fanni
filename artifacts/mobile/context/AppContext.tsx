import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEED_VERSION } from "../constants/seedVersion";

export type Language = "ar" | "en";
export type UserType = "client" | "technician" | "admin" | null;

export interface User {
  id: string;
  type: UserType;
  name: string;
  mobile: string;
  email: string;
  password?: string;
  address?: string;
  profession?: string;
  specialty?: string;
  experience?: number;
  governorate?: string;
  governorateNameAr?: string;
  governorateNameEn?: string;
  area?: string;
  areaNameAr?: string;
  areaNameEn?: string;
  district?: string;
  rating?: number;
  avatar?: string;
  serviceCategories?: string[];
  serviceStart?: string;
  serviceEnd?: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  t: (key: string) => string;
  user: User | null;
  setUser: (user: User | null) => void;
  userType: UserType;
  setUserType: (type: UserType) => void;
  isLoggedIn: boolean;
  isOnline: boolean;
  setIsOnline: (value: boolean, sessionToken?: string) => Promise<void>;
  isAvailabilityHydrated: boolean;
  hasPendingToggle: boolean;
  syncAvailabilityFromServer: (sessionToken: string) => Promise<boolean>;
  retryPendingAvailabilityToggle: () => Promise<boolean>;
}

const translations: Record<string, Record<Language, string>> = {
  // App
  "app.name": { ar: "فني", en: "Fanni" },
  "app.tagline": { ar: "خدمات الصيانة المنزلية", en: "Home Maintenance Services" },

  // Splash / Welcome
  "welcome.title": { ar: "مرحباً بك في فني", en: "Welcome to Fanni" },
  "welcome.subtitle": { ar: "خدمات الصيانة المنزلية في متناول يدك", en: "Home maintenance at your fingertips" },
  "welcome.client": { ar: "دخول كعميل", en: "Login as Client" },
  "welcome.technician": { ar: "دخول كفني", en: "Login as Technician" },
  "welcome.admin": { ar: "دخول كمسئول", en: "Admin Login" },
  "welcome.register": { ar: "تسجيل حساب جديد", en: "Create New Account" },

  // Login
  "login.title": { ar: "تسجيل الدخول", en: "Sign In" },
  "login.mobile": { ar: "رقم الموبايل", en: "Mobile Number" },
  "login.password": { ar: "كلمة المرور", en: "Password" },
  "login.submit": { ar: "دخول", en: "Sign In" },
  "login.forgot": { ar: "نسيت كلمة المرور؟", en: "Forgot Password?" },
  "login.noAccount": { ar: "ليس لديك حساب؟", en: "Don't have an account?" },
  "login.register": { ar: "إنشاء حساب", en: "Register" },

  // Forgot password
  "forgot.title": { ar: "استعادة كلمة المرور", en: "Reset Password" },
  "forgot.subtitle": { ar: "أدخل بريدك الإلكتروني أو رقم هاتفك وسنرسل لك رمز التحقق", en: "Enter your email or mobile number and we'll send you a reset code" },
  "forgot.identifier": { ar: "البريد الإلكتروني أو رقم الهاتف", en: "Email or Mobile Number" },
  "forgot.send": { ar: "إرسال الرمز", en: "Send Code" },
  "forgot.sent": { ar: "تم إرسال رمز التحقق", en: "Reset code sent" },
  "forgot.sentDesc": { ar: "تحقق من بريدك الإلكتروني أو هاتفك للحصول على رمز التحقق المكون من 6 أرقام", en: "Check your email or phone for the 6-digit reset code" },
  "forgot.code": { ar: "رمز التحقق", en: "Reset Code" },
  "forgot.codePlaceholder": { ar: "أدخل الرمز المكون من 6 أرقام", en: "Enter 6-digit code" },
  "forgot.newPassword": { ar: "كلمة المرور الجديدة", en: "New Password" },
  "forgot.confirmPassword": { ar: "تأكيد كلمة المرور", en: "Confirm Password" },
  "forgot.resetBtn": { ar: "تعيين كلمة المرور الجديدة", en: "Set New Password" },
  "forgot.success": { ar: "تم تغيير كلمة المرور بنجاح!", en: "Password changed successfully!" },
  "forgot.successDesc": { ar: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة", en: "You can now sign in with your new password" },
  "forgot.backToLogin": { ar: "العودة لتسجيل الدخول", en: "Back to Sign In" },
  "forgot.invalidCode": { ar: "الرمز غير صحيح أو منتهي الصلاحية", en: "Invalid or expired code" },
  "forgot.passwordMismatch": { ar: "كلمتا المرور غير متطابقتين", en: "Passwords do not match" },
  "forgot.passwordTooShort": { ar: "يجب أن تكون كلمة المرور 6 أحرف على الأقل", en: "Password must be at least 6 characters" },

  // Register
  "register.title": { ar: "إنشاء حساب جديد", en: "Create Account" },
  "register.asClient": { ar: "تسجيل كعميل", en: "Register as Client" },
  "register.asTech": { ar: "تسجيل كفني", en: "Register as Technician" },
  "register.step1": { ar: "البيانات الشخصية", en: "Personal Info" },
  "register.step2": { ar: "بيانات الحساب", en: "Account Info" },
  "register.step3": { ar: "المنطقة الجغرافية", en: "Service Area" },
  "register.name": { ar: "الاسم الكامل", en: "Full Name" },
  "register.age": { ar: "السن", en: "Age" },
  "register.mobile": { ar: "رقم الموبايل", en: "Mobile Number" },
  "register.email": { ar: "البريد الإلكتروني", en: "Email Address" },
  "register.address": { ar: "العنوان", en: "Address" },
  "register.idPhoto": { ar: "صورة البطاقة الشخصية", en: "National ID Photo" },
  "register.profession": { ar: "المهنة", en: "Profession" },
  "register.specialty": { ar: "التخصص", en: "Specialty" },
  "register.experience": { ar: "سنوات الخبرة", en: "Years of Experience" },
  "register.workPhotos": { ar: "صور من سابقة الأعمال", en: "Previous Work Photos" },
  "register.licensePhoto": { ar: "صورة كارنيه مزاولة المهنة", en: "Professional License Photo" },
  "register.governorate": { ar: "المحافظة", en: "Governorate" },
  "register.area": { ar: "المنطقة", en: "Area" },
  "register.district": { ar: "الحي", en: "District" },
  "register.serviceRadius": { ar: "نطاق الخدمة", en: "Service Radius" },
  "register.serviceStart": { ar: "بداية وقت الخدمة", en: "Service Start Time" },
  "register.serviceEnd": { ar: "نهاية وقت الخدمة", en: "Service End Time" },
  "register.paymentMethod": { ar: "طريقة الدفع", en: "Payment Method" },
  "register.bankAccount": { ar: "حساب بنكي", en: "Bank Account" },
  "register.eWallet": { ar: "محفظة إلكترونية", en: "E-Wallet" },
  "register.instaPay": { ar: "انستا باي", en: "InstaPay" },
  "register.success": { ar: "تم التسجيل بنجاح!", en: "Registration Successful!" },
  "register.successMsg": { ar: "تم حفظ بياناتك بنجاح. يمكنك الآن تسجيل الدخول.", en: "Your details have been saved. You can now sign in." },
  "register.welcomeName": { ar: "مرحباً،", en: "Welcome," },
  "register.clientNextSteps": { ar: "يمكنك الآن تصفح الخدمات وطلب فني متخصص بنقرة واحدة.", en: "You can now browse services and book a specialist with just one tap." },
  "register.techNextSteps": { ar: "أنت جاهز لاستقبال الطلبات. فعّل تواجدك لتبدأ العمل.", en: "You're ready to receive orders. Enable your availability to start working." },
  "register.savedCategories": { ar: "تخصصاتك المحفوظة", en: "Your Saved Specialties" },
  "register.noCategoriesHint": { ar: "لم يتم حفظ تخصصات بعد. يمكنك تحديثها من ملفك الشخصي.", en: "No specialties saved yet. You can add them from your profile." },
  "register.goHome": { ar: "ابدأ الآن", en: "Get Started" },
  "availability.synced": { ar: "تمت مزامنة التواجد", en: "Availability synced" },
  "availability.syncFailed": { ar: "تعذّر مزامنة التواجد — يرجى التحقق من اتصالك", en: "Couldn't sync availability — please check your connection" },

  // Navigation
  "nav.home": { ar: "الرئيسية", en: "Home" },
  "nav.orders": { ar: "الطلبات", en: "Orders" },
  "nav.profile": { ar: "الملف الشخصي", en: "Profile" },
  "nav.invoices": { ar: "الفواتير", en: "Invoices" },
  "nav.stats": { ar: "الإحصائيات", en: "Statistics" },
  "nav.map": { ar: "الخريطة", en: "Map" },

  // Categories
  "cat.electricity": { ar: "كهرباء", en: "Electricity" },
  "cat.plumbing": { ar: "سباكة", en: "Plumbing" },
  "cat.ac": { ar: "تكييف", en: "Air Conditioning" },
  "cat.carpentry": { ar: "نجارة", en: "Carpentry" },
  "cat.appliances": { ar: "أجهزة منزلية", en: "Appliances" },
  "cat.painting": { ar: "دهانات", en: "Painting" },
  "cat.pest": { ar: "مكافحة حشرات", en: "Pest Control" },
  "cat.flooring": { ar: "أرضيات", en: "Flooring" },
  "cat.ac.sub1": { ar: "صيانة مكيفات", en: "AC Repair" },
  "cat.ac.sub2": { ar: "تنظيف مكيفات", en: "AC Cleaning" },
  "cat.elec.sub1": { ar: "توصيلات كهربائية", en: "Electrical Wiring" },
  "cat.elec.sub2": { ar: "أجهزة كمبيوتر", en: "Computers" },
  "cat.elec.sub3": { ar: "غسالات", en: "Washing Machines" },
  "cat.elec.sub4": { ar: "سخانات", en: "Water Heaters" },

  // Order flow
  "order.new": { ar: "طلب جديد", en: "New Request" },
  "order.describe": { ar: "وصف المشكلة", en: "Describe the Problem" },
  "order.problemDesc": { ar: "وصف المشكلة بالتفصيل", en: "Problem Description" },
  "order.deviceType": { ar: "نوع الجهاز", en: "Device Type" },
  "order.photos": { ar: "صور المشكلة", en: "Problem Photos" },
  "order.addPhoto": { ar: "إضافة صورة", en: "Add Photo" },
  "order.schedule": { ar: "موعد الزيارة", en: "Visit Schedule" },
  "order.street": { ar: "اسم الشارع", en: "Street Name" },
  "order.building": { ar: "رقم العقار", en: "Building No." },
  "order.floor": { ar: "رقم الدور", en: "Floor No." },
  "order.apt": { ar: "رقم الشقة", en: "Apartment No." },
  "order.landmark": { ar: "علامة مميزة", en: "Landmark" },
  "order.visitDate": { ar: "موعد الزيارة", en: "Visit Date" },
  "order.visitTime": { ar: "وقت الزيارة", en: "Visit Time" },
  "order.confirm": { ar: "تأكيد الطلب", en: "Confirm Request" },
  "order.tracking": { ar: "تتبع الطلب", en: "Order Tracking" },
  "order.number": { ar: "رقم الطلب", en: "Order #" },
  "order.status.pending": { ar: "في الانتظار", en: "Pending" },
  "order.status.accepted": { ar: "مقبول", en: "Accepted" },
  "order.status.inProgress": { ar: "جاري التنفيذ", en: "In Progress" },
  "order.status.completed": { ar: "مكتمل", en: "Completed" },
  "order.status.cancelled": { ar: "ملغي", en: "Cancelled" },
  "order.techInfo": { ar: "بيانات الفني", en: "Technician Info" },
  "order.confirmCompletion": { ar: "تأكيد الإنهاء", en: "Confirm Completion" },
  "order.solved": { ar: "تم حل المشكلة", en: "Problem Solved" },
  "order.stillExists": { ar: "المشكلة لا تزال موجودة", en: "Problem Still Exists" },
  "order.worsened": { ar: "المشكلة ازدادت سوءاً", en: "Problem Worsened" },
  "order.payment": { ar: "الدفع والفاتورة", en: "Payment & Invoice" },
  "order.rate": { ar: "تقييم الفني", en: "Rate Technician" },
  "order.rateComment": { ar: "ملاحظاتك", en: "Your Comments" },
  "order.submit": { ar: "إرسال الطلب", en: "Submit Request" },
  "order.history": { ar: "الطلبات السابقة", en: "Previous Orders" },
  "order.active": { ar: "الطلبات الحالية", en: "Active Orders" },
  "order.trackMap": { ar: "تتبع الطلب على الخريطة", en: "Track Order on Map" },
  "order.trackBtn": { ar: "تتبع الفني على الخريطة", en: "Track Technician on Map" },
  "order.techLocation": { ar: "موقع الفني", en: "Technician Location" },
  "order.yourLocation": { ar: "موقعك", en: "Your Location" },
  "order.onTheWay": { ar: "في الطريق إليك", en: "On the way to you" },
  "order.arrivingIn": { ar: "الوصول خلال ~", en: "Arriving in ~" },
  "order.arrivingNow": { ar: "يصل الآن", en: "Arriving now" },
  "order.technicianArrived": { ar: "الفني وصل!", en: "Technician has arrived!" },
  "order.confirmArrival": { ar: "تأكيد الوصول وبدء العمل", en: "Confirm Arrival & Start Job" },
  "order.jobInProgress": { ar: "العمل جارٍ الآن", en: "Job in Progress" },
  "order.confirmArrivalError": { ar: "تعذر تأكيد الوصول، حاول مجدداً", en: "Could not confirm arrival, please try again" },
  "order.minutes": { ar: "دقيقة", en: "min" },
  "order.seconds": { ar: "ث", en: "s" },
  "order.km": { ar: "كم", en: "km" },
  "order.m": { ar: "م", en: "m" },
  "order.routeLine": { ar: "مسار الفني", en: "Tech Route" },
  "order.trafficLegend": { ar: "حركة المرور", en: "Traffic" },
  "order.trafficSlow": { ar: "حركة بطيئة", en: "Slow traffic" },
  "order.trafficFast": { ar: "حركة سريعة", en: "Moving fast" },
  "order.segmentVerySlow": { ar: "بطيء جداً — ~8 كم/س", en: "Very slow — ~8 km/h" },
  "order.segmentSlow": { ar: "بطيء — ~15 كم/س", en: "Slow traffic — ~15 km/h" },
  "order.segmentNormal": { ar: "عادي — ~35 كم/س", en: "Normal — ~35 km/h" },
  "order.segmentFast": { ar: "طريق واضح — ~60 كم/س", en: "Clear road — ~60 km/h" },
  "order.shareTracking": { ar: "مشاركة رابط التتبع", en: "Share Tracking Link" },
  "order.shareTrackingMsg": { ar: "تابع موقع الفني في الوقت الفعلي", en: "Follow the technician's location in real time" },
  "order.shareTrackingCopied": { ar: "تم نسخ رابط التتبع", en: "Tracking link copied" },
  "order.callTech": { ar: "اتصل بالفني", en: "Call Technician" },
  "order.smsTech": { ar: "رسالة للفني", en: "SMS Technician" },
  "order.messageTech": { ar: "رسالة للفني", en: "Message Technician" },
  "order.messageClient": { ar: "رسالة للعميل", en: "Message Client" },
  "order.callClient": { ar: "اتصل بالعميل", en: "Call Client" },

  // Technician
  "tech.newOrder": { ar: "طلب جديد!", en: "New Order!" },
  "tech.accept": { ar: "قبول", en: "Accept" },
  "tech.reject": { ar: "رفض", en: "Reject" },
  "tech.online": { ar: "متاح", en: "Online" },
  "tech.offline": { ar: "غير متاح", en: "Offline" },
  "tech.syncing": { ar: "جارٍ المزامنة", en: "Syncing..." },
  "tech.materials": { ar: "البضاعة والمستلزمات", en: "Materials & Supplies" },
  "tech.materialPhoto": { ar: "صورة الفاتورة", en: "Invoice Photo" },
  "tech.materialDesc": { ar: "وصف الأصناف", en: "Items Description" },
  "tech.addMaterial": { ar: "إضافة فاتورة أخرى", en: "Add Another Invoice" },
  "tech.complete": { ar: "إنهاء المشكلة", en: "Complete Job" },
  "tech.solutionDesc": { ar: "وصف الحل", en: "Solution Description" },
  "tech.clientSatisfied": { ar: "مدى رضا العميل", en: "Client Satisfaction" },
  "tech.satisfied": { ar: "راضٍ", en: "Satisfied" },
  "tech.neutral": { ar: "محايد", en: "Neutral" },
  "tech.unsatisfied": { ar: "غير راضٍ", en: "Unsatisfied" },

  // Invoice
  "invoice.title": { ar: "فاتورة", en: "Invoice" },
  "invoice.number": { ar: "رقم الفاتورة", en: "Invoice #" },
  "invoice.date": { ar: "التاريخ", en: "Date" },
  "invoice.client": { ar: "العميل", en: "Client" },
  "invoice.category": { ar: "الخدمة", en: "Service" },
  "invoice.orderNumber": { ar: "رقم الطلب", en: "Order #" },
  "invoice.materials": { ar: "تكلفة المواد", en: "Materials Cost" },
  "invoice.materialsMark": { ar: "هامش المواد (10%)", en: "Materials Markup (10%)" },
  "invoice.labor": { ar: "أجر الخدمة والمصنعية", en: "Labor & Service Fee" },
  "invoice.tools": { ar: "إيجار العدد", en: "Tool Rental" },
  "invoice.tax": { ar: "الضريبة (14%)", en: "Tax (14%)" },
  "invoice.vat": { ar: "ضريبة القيمة المضافة (14%)", en: "VAT (14%)" },
  "invoice.total": { ar: "الإجمالي", en: "Total" },
  "invoice.technician": { ar: "الفني", en: "Technician" },
  "invoice.phone": { ar: "الهاتف", en: "Phone" },
  "invoice.download": { ar: "تحميل الفاتورة", en: "Download Invoice" },
  "invoice.share": { ar: "مشاركة الفاتورة", en: "Share Invoice" },
  "invoice.shareError": { ar: "تعذّر إنشاء ملف PDF", en: "Could not generate PDF" },

  // Admin
  "admin.dashboard": { ar: "لوحة التحكم", en: "Dashboard" },
  "admin.users": { ar: "المستخدمون", en: "Users" },
  "admin.technicians": { ar: "الفنيون", en: "Technicians" },
  "admin.clients": { ar: "العملاء", en: "Clients" },
  "admin.orders": { ar: "الطلبات", en: "Orders" },
  "admin.invoices": { ar: "الفواتير", en: "Invoices" },
  "admin.stats": { ar: "الإحصائيات", en: "Statistics" },
  "admin.permissions": { ar: "الصلاحيات", en: "Permissions" },
  "common.all": { ar: "الكل", en: "All" },
  "role.admin": { ar: "مسؤول", en: "Admin" },
  "role.technician": { ar: "فني", en: "Technician" },
  "role.client": { ar: "عميل", en: "Client" },
  "loginLogs.title": { ar: "سجل تسجيل الدخول", en: "Login Logs" },
  "loginLogs.success": { ar: "ناجح", en: "Success" },
  "loginLogs.failed": { ar: "فاشل", en: "Failed" },
  "loginLogs.filterRole": { ar: "تصفية حسب النوع", en: "Filter by role" },
  "loginLogs.filterStatus": { ar: "تصفية حسب الحالة", en: "Filter by status" },
  "loginLogs.empty": { ar: "لا توجد سجلات دخول بعد", en: "No login logs yet" },
  "loginLogs.totalEntries": { ar: "إجمالي السجلات: {n}", en: "Total entries: {n}" },
  "loginLogs.failureInvalidPassword": { ar: "كلمة مرور خاطئة", en: "Invalid password" },
  "loginLogs.failureNotFound": { ar: "المستخدم غير موجود", en: "User not found" },
  "loginLogs.failureSuspended": { ar: "الحساب موقوف", en: "Account suspended" },
  "admin.approve": { ar: "موافقة", en: "Approve" },
  "admin.suspend": { ar: "تعليق", en: "Suspend" },
  "admin.totalRevenue": { ar: "إجمالي الإيرادات", en: "Total Revenue" },
  "admin.activeOrders": { ar: "الطلبات النشطة", en: "Active Orders" },
  "admin.registeredTechs": { ar: "الفنيون المسجلون", en: "Registered Technicians" },
  "admin.totalClients": { ar: "إجمالي العملاء", en: "Total Clients" },
  "admin.profile": { ar: "الملف الشخصي", en: "Profile" },
  "admin.defaultPasswordBanner": { ar: "أنت تستخدم كلمة المرور الافتراضية. يرجى تغييرها فوراً.", en: "You are using the default password. Please change it immediately." },
  "admin.changePasswordNow": { ar: "تغيير الآن", en: "Change it now" },

  // Profile
  "profile.firstName": { ar: "الاسم الأول", en: "First Name" },
  "profile.lastName": { ar: "اسم العائلة", en: "Last Name" },
  "profile.saveSuccess": { ar: "تم حفظ التغييرات بنجاح", en: "Changes saved successfully" },
  "profile.logoutConfirm": { ar: "هل أنت متأكد أنك تريد تسجيل الخروج؟", en: "Are you sure you want to log out?" },
  "profile.adminRole": { ar: "مسئول النظام", en: "System Admin" },
  "profile.mobileReadOnly": { ar: "رقم الجوال لا يمكن تغييره", en: "Mobile number cannot be changed" },
  "profile.noServer": { ar: "تعذر الاتصال بالخادم", en: "Unable to reach server" },
  "profile.saveFailed": { ar: "فشل الحفظ", en: "Failed to save" },
  "profile.saving": { ar: "جاري الحفظ...", en: "Saving..." },
  "profile.title": { ar: "الملف الشخصي", en: "My Profile" },
  "profile.edit": { ar: "تعديل البيانات", en: "Edit Profile" },
  "profile.logout": { ar: "تسجيل الخروج", en: "Logout" },
  "profile.language": { ar: "اللغة", en: "Language" },
  "profile.arabic": { ar: "العربية", en: "Arabic" },
  "profile.english": { ar: "الإنجليزية", en: "English" },
  "profile.reports": { ar: "التقارير", en: "Reports" },
  "profile.previousOrders": { ar: "الطلبات السابقة", en: "Previous Orders" },
  "profile.previousInvoices": { ar: "الفواتير السابقة", en: "Previous Invoices" },
  "profile.changePassword": { ar: "تغيير كلمة المرور", en: "Change Password" },
  "profile.currentPassword": { ar: "كلمة المرور الحالية", en: "Current Password" },
  "profile.newPassword": { ar: "كلمة المرور الجديدة", en: "New Password" },
  "profile.confirmPassword": { ar: "تأكيد كلمة المرور", en: "Confirm New Password" },
  "profile.passwordUpdated": { ar: "تم تحديث كلمة المرور بنجاح", en: "Password updated successfully" },
  "profile.wrongCurrentPassword": { ar: "كلمة المرور الحالية غير صحيحة", en: "Current password is incorrect" },
  "profile.passwordChanging": { ar: "جاري التغيير...", en: "Changing..." },
  "profile.resendWelcome": { ar: "إعادة إرسال رسالة الترحيب", en: "Resend Welcome Message" },
  "profile.resendWelcomeSent": { ar: "تم إرسال رسالة الترحيب إلى معلومات تواصلك المسجّلة", en: "Welcome message sent to your registered contact" },
  "profile.resendWelcomeNoEmail": { ar: "لا توجد معلومات تواصل مسجّلة لإرسال الرسالة إليها", en: "No contact information on file to send the message to" },
  "profile.resendWelcomeRateLimited": { ar: "لقد أرسلت الرسالة مؤخراً. انتظر قليلاً قبل المحاولة مرة أخرى.", en: "You sent this recently. Please wait before trying again." },
  "profile.resendWelcomeError": { ar: "تعذّر إرسال الرسالة. حاول مرة أخرى.", en: "Could not send the message. Please try again." },

  // Common
  "common.next": { ar: "التالي", en: "Next" },
  "common.back": { ar: "السابق", en: "Back" },
  "common.save": { ar: "حفظ", en: "Save" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.confirm": { ar: "تأكيد", en: "Confirm" },
  "common.close": { ar: "إغلاق", en: "Close" },
  "common.upload": { ar: "رفع ملف", en: "Upload File" },
  "common.required": { ar: "* مطلوب", en: "* Required" },
  "common.egp": { ar: "ج.م", en: "EGP" },
  "common.selectDate": { ar: "اختر التاريخ", en: "Select Date" },
  "common.selectTime": { ar: "اختر الوقت", en: "Select Time" },
  "common.loading": { ar: "جاري التحميل...", en: "Loading..." },
  "common.error": { ar: "حدث خطأ", en: "An error occurred" },
  "common.retry": { ar: "إعادة المحاولة", en: "Retry" },
  "common.noData": { ar: "لا توجد بيانات", en: "No data available" },
  "order.updated": { ar: "تم التحديث", en: "Updated" },
  "order.noOrdersYet": { ar: "لم تقم بأي طلبات حتى الآن", en: "You haven't placed any orders yet" },
  "order.noOrdersHint": { ar: "ستظهر هنا جميع طلباتك بعد إنشائها", en: "All your orders will appear here once you place them" },
  "order.bookService": { ar: "احجز خدمة", en: "Book a Service" },
  "invoice.noInvoicesYet": { ar: "لا توجد فواتير بعد", en: "No invoices yet" },
  "invoice.noInvoicesHint": { ar: "ستظهر هنا فواتيرك بعد اكتمال الخدمات. احجز خدمتك الأولى الآن!", en: "Your invoices will appear here once your services are completed. Book your first service now!" },
  "common.search": { ar: "بحث...", en: "Search..." },
  "common.filter": { ar: "تصفية", en: "Filter" },
  "common.from": { ar: "من", en: "From" },
  "common.to": { ar: "إلى", en: "To" },
  "common.date": { ar: "التاريخ", en: "Date" },
  "common.total": { ar: "الإجمالي", en: "Total" },
  "common.stars": { ar: "نجوم", en: "Stars" },
  "common.sendOrder": { ar: "إرسال الطلب", en: "Submit Request" },
  "common.getLocation": { ar: "تحديد الموقع", en: "Get Location" },

  // OTP verification
  "otp.title": { ar: "التحقق من الهاتف", en: "Phone Verification" },
  "otp.heading": { ar: "أدخل رمز التحقق", en: "Enter verification code" },
  "otp.sent": { ar: "تم إرسال رمز مكون من 6 أرقام إلى", en: "We sent a 6-digit code to" },
  "otp.verify": { ar: "تحقق", en: "Verify" },
  "otp.noCode": { ar: "لم يصلك الرمز؟", en: "Didn't receive the code?" },
  "otp.resend": { ar: "إعادة الإرسال", en: "Resend" },

  // Service area
  "photo.gallery": { ar: "معرض الصور", en: "Photo Gallery" },
  "photo.phase.problem": { ar: "صور المشكلة", en: "Problem Photos" },
  "photo.phase.before": { ar: "قبل البدء", en: "Before Work" },
  "photo.phase.during": { ar: "أثناء العمل", en: "During Work" },
  "photo.phase.after": { ar: "بعد الإنهاء", en: "After Completion" },
  "photo.addBefore": { ar: "إضافة صور قبل البدء", en: "Add Before Photos" },
  "photo.addDuring": { ar: "إضافة صور أثناء العمل", en: "Add During Photos" },
  "photo.addAfter": { ar: "إضافة صور بعد الإنهاء", en: "Add After Photos" },
  "photo.uploading": { ar: "جاري رفع الصورة...", en: "Uploading photo..." },

  "tech.serviceArea": { ar: "منطقة الخدمة النشطة", en: "Active Service Area" },
  "tech.noServiceArea": { ar: "لم يتم تحديد منطقة خدمة بعد", en: "No service area set yet" },
  "tech.noServiceAreaPrompt": { ar: "اضغط هنا لتحديث ملفك الشخصي", en: "Tap here to update your profile" },
  "tech.updateProfile": { ar: "تحديث ملفك الشخصي", en: "Update your profile" },
  "tech.toReceiveOrders": { ar: "لتلقي الطلبات في منطقتك", en: "to receive orders in your area" },
  "tech.noJobsYet": { ar: "لا توجد طلبات بعد", en: "No jobs yet" },
  "tech.noJobsHint": { ar: "أكمل ملفك الشخصي وحدد منطقة الخدمة لتبدأ في تلقي الطلبات", en: "Complete your profile and set your service area to start receiving jobs" },
  "tech.completeProfile": { ar: "أكمل ملفك الشخصي", en: "Complete your profile" },
  "tech.allOrdersShown": { ar: "تعرض جميع الطلبات — حدد منطقتك لتصفيتها", en: "Showing all orders — set your area to filter results" },
  "tech.filteredByArea": { ar: "الطلبات مصفاة حسب منطقة خدمتك", en: "Orders filtered by your service area" },
  "tech.noCategories": { ar: "لم تختر تخصصات الخدمة بعد", en: "No service categories selected yet" },
  "tech.noCategoriesPrompt": { ar: "بدون تخصصات لن تتلقى أي طلبات — اضغط لإضافتها الآن", en: "Without categories you won't receive orders — tap to add them now" },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const PENDING_TOGGLE_KEY = "pendingAvailabilityToggle";

const USER_SEED_VERSION_KEY = "user_seed_version";
// Keep this set in sync with the user IDs in OrderContext SEED_ORDERS.
// Bump SEED_VERSION in constants/seedVersion.ts whenever seed data changes.
const SEED_USER_IDS = new Set(["tech1", "client1", "client2", "client3"]);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [user, setUserState] = useState<User | null>(null);
  const [userType, setUserTypeState] = useState<UserType>(null);
  const [isOnline, setIsOnlineState] = useState<boolean>(false);
  const [isAvailabilityHydrated, setIsAvailabilityHydrated] = useState<boolean>(false);
  const [hasPendingToggle, setHasPendingToggle] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem("language");
        if (storedLang === "ar" || storedLang === "en") {
          setLanguageState(storedLang);
        }
        const storedUser = await AsyncStorage.getItem("user");
        const storedVersion = await AsyncStorage.getItem(USER_SEED_VERSION_KEY);
        const versionMismatch = storedVersion !== SEED_VERSION;
        if (versionMismatch) {
          await AsyncStorage.setItem(USER_SEED_VERSION_KEY, SEED_VERSION);
        }
        if (storedUser) {
          const parsed = JSON.parse(storedUser) as User;
          if (versionMismatch && SEED_USER_IDS.has(parsed.id)) {
            await AsyncStorage.removeItem("user");
          } else {
            setUserState(parsed);
            setUserTypeState(parsed.type);
          }
        }
        const storedOnline = await AsyncStorage.getItem("techIsOnline");
        setIsOnlineState(storedOnline === "true");
        const pendingRaw = await AsyncStorage.getItem(PENDING_TOGGLE_KEY);
        setHasPendingToggle(!!pendingRaw);
      } catch (_) {
        setIsOnlineState(false);
      } finally {
        setIsAvailabilityHydrated(true);
      }
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem("language", lang);
    } catch (_) {}
  };

  const setUser = async (u: User | null) => {
    setUserState(u);
    setUserTypeState(u ? u.type : null);
    try {
      if (u) {
        await AsyncStorage.setItem("user", JSON.stringify(u));
      } else {
        await AsyncStorage.removeItem("user");
        await AsyncStorage.removeItem(PENDING_TOGGLE_KEY);
        setHasPendingToggle(false);
      }
    } catch (_) {}
  };

  const syncAvailabilityFromServer = async (sessionToken: string): Promise<boolean> => {
    const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
    const apiBase = domain ? `https://${domain}` : "";
    if (!apiBase) return false;
    let res: Response;
    try {
      res = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch (networkErr) {
      throw networkErr;
    }
    if (!res.ok) return false;
    try {
      const data = await res.json() as { user?: { isAvailable?: boolean | null } | null };
      const serverIsAvailable = data?.user?.isAvailable;
      const resolvedValue = typeof serverIsAvailable === "boolean" ? serverIsAvailable : false;
      setIsOnlineState(resolvedValue);
      try {
        await AsyncStorage.setItem("techIsOnline", String(resolvedValue));
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  };

  const setIsOnline = async (value: boolean, sessionToken?: string) => {
    setIsOnlineState(value);
    try {
      await AsyncStorage.setItem("techIsOnline", String(value));
    } catch (_) {}
    if (user?.id && sessionToken) {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const apiBase = domain ? `https://${domain}` : "";
      if (apiBase) {
        try {
          const res = await fetch(
            `${apiBase}/api/technicians/${user.id}/availability`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({ isAvailable: value }),
            }
          );
          if (res.ok) {
            setHasPendingToggle(false);
            try { await AsyncStorage.removeItem(PENDING_TOGGLE_KEY); } catch (_) {}
          }
        } catch (_networkErr) {
          setHasPendingToggle(true);
          try {
            await AsyncStorage.setItem(
              PENDING_TOGGLE_KEY,
              JSON.stringify({ value, sessionToken, userId: user.id })
            );
          } catch (_) {}
        }
      }
    }
  };

  const retryPendingAvailabilityToggle = async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_TOGGLE_KEY);
      if (!raw) return false;
      const { value, sessionToken, userId } = JSON.parse(raw) as {
        value: boolean;
        sessionToken: string;
        userId: string;
      };
      if (!user?.id || user.id !== userId) {
        setHasPendingToggle(false);
        try { await AsyncStorage.removeItem(PENDING_TOGGLE_KEY); } catch (_) {}
        return false;
      }
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const apiBase = domain ? `https://${domain}` : "";
      if (!apiBase) return false;
      const res = await fetch(
        `${apiBase}/api/technicians/${userId}/availability`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ isAvailable: value }),
        }
      );
      if (res.ok) {
        setHasPendingToggle(false);
        try { await AsyncStorage.removeItem(PENDING_TOGGLE_KEY); } catch (_) {}
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  };

  const setUserType = (type: UserType) => {
    setUserTypeState(type);
  };

  const t = (key: string): string => {
    return translations[key]?.[language] ?? key;
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        isRTL: language === "ar",
        t,
        user,
        setUser,
        userType,
        setUserType,
        isLoggedIn: !!user,
        isOnline,
        setIsOnline,
        isAvailabilityHydrated,
        hasPendingToggle,
        syncAvailabilityFromServer,
        retryPendingAvailabilityToggle,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
