require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");

const app = express();
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const QRCode = require("qrcode");
const path = require("path");
const User = require("./src/models/User");
const AttendanceSession = require("./src/models/AttendanceSession");
const Attendance = require("./src/models/Attendance");
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false, saveUninitialized: false,
  store: process.env.MONGODB_URI ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: "sessions" }) : undefined,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 8 }
}));
app.use((req,res,next)=>{ res.locals.currentUser=req.session.user||null; res.locals.message=req.session.message||null; delete req.session.message; next(); });
const isTeacher = user => user && user.role === "teacher";
const isAdmin = user => user && user.role === "admin";
function requireLogin(req,res,next){ if(!req.session.user) return res.redirect("/login"); next(); }
function requireTeacher(req,res,next){ if(!isTeacher(req.session.user)) return res.status(403).render("error",{title:"Access denied",message:"This area is for teachers only."}); next(); }
function requireAdmin(req,res,next){ if(!isAdmin(req.session.user)) return res.status(403).render("error",{title:"Access denied",message:"This area is for administrators only."}); next(); }
function requireStudent(req,res,next){ if(!req.session.user || req.session.user.role!=="student") return res.status(403).render("error",{title:"Access denied",message:"Please sign in using the student portal."}); next(); }
function setMessage(req,message){ req.session.message=message; }
app.get("/health",(req,res)=>res.json({status:"ok"}));
app.get("/",(req,res)=>{ if(!req.session.user) return res.redirect("/login"); return res.redirect(isAdmin(req.session.user)?"/admin":isTeacher(req.session.user)?"/teacher":"/student"); });
app.get("/login",(req,res)=>res.render("portal",{title:"Choose Login Portal"}));
app.get("/teacher/login",(req,res)=>res.render("teacher-login",{title:"Teacher Login"}));
app.get("/admin/login",(req,res)=>res.render("admin-login",{title:"Administrator Login"}));
app.get("/student/login",(req,res)=>res.render("student-login",{title:"Student Login"}));
app.get("/register",(req,res)=>res.render("register",{title:"Student Registration"}));
app.post("/register",async(req,res)=>{
 try { const {name,studentId,email,password,confirmPassword}=req.body;
  if(!name||!studentId||!email||!password){setMessage(req,"Please complete all fields.");return res.redirect("/register");}
  if(password.length<8){setMessage(req,"Password must be at least 8 characters.");return res.redirect("/register");}
  if(password!==confirmPassword){setMessage(req,"Passwords do not match.");return res.redirect("/register");}
  const cleanEmail=email.toLowerCase().trim();
  if(await User.findOne({$or:[{email:cleanEmail},{studentId:studentId.trim()}]})){setMessage(req,"Email or student ID is already registered.");return res.redirect("/register");}
  await User.create({name,studentId:studentId.trim(),email:cleanEmail,passwordHash:await bcrypt.hash(password,12),role:"student"});
  setMessage(req,"Registration successful. Please sign in."); res.redirect("/student/login");
 } catch(err){console.error(err);setMessage(req,"Registration failed. Please try again.");res.redirect("/register");}
});
async function loginHandler(req,res,expectedRole){
 try { const email=(req.body.email||"").toLowerCase().trim(); const user=await User.findOne({email});
  const allowed=user && (expectedRole==="admin"?isAdmin(user):expectedRole==="teacher"?isTeacher(user):user.role==="student");
  if(!allowed || !(await bcrypt.compare(req.body.password||"",user.passwordHash))){setMessage(req,"Invalid credentials for this portal.");return res.redirect(expectedRole==="admin"?"/admin/login":expectedRole==="teacher"?"/teacher/login":"/student/login");}
  req.session.regenerate(err=>{if(err)return res.status(500).send("Could not start session.");req.session.user={id:user._id.toString(),name:user.name,role:user.role,studentId:user.studentId};res.redirect(isAdmin(user)?"/admin":isTeacher(user)?"/teacher":"/student");});
 } catch(err){console.error(err);setMessage(req,"Login failed. Please try again.");res.redirect(expectedRole==="admin"?"/admin/login":expectedRole==="teacher"?"/teacher/login":"/student/login");}
}
app.post("/teacher/login",(req,res)=>loginHandler(req,res,"teacher"));
app.post("/admin/login",(req,res)=>loginHandler(req,res,"admin"));
app.post("/student/login",(req,res)=>loginHandler(req,res,"student"));
app.post("/login",(req,res)=>res.redirect("/login"));
app.post("/logout",requireLogin,(req,res)=>req.session.destroy(()=>res.redirect("/login")));
app.get("/teacher",requireTeacher,async(req,res)=>{
 const [studentCount,sessionCount,attendanceCount,todayCount,recent,activeCount]=await Promise.all([
  User.countDocuments({role:"student"}),AttendanceSession.countDocuments(),Attendance.countDocuments(),
  Attendance.countDocuments({scannedAt:{$gte:new Date(new Date().setHours(0,0,0,0))}}),
  Attendance.find().sort({scannedAt:-1}).limit(8).populate("student","name studentId").populate("attendanceSession","title"),
  AttendanceSession.countDocuments({active:true,expiresAt:{$gt:new Date()}})
 ]);
 res.render("admin",{title:"Teacher Dashboard",studentCount,sessionCount,attendanceCount,todayCount,recent,activeCount});
});
// Administrator workspace: separate from the teacher portal and read-only monitoring.
app.get("/admin",requireAdmin,async(req,res)=>{
 const [studentCount,teacherCount,sessionCount,attendanceCount,todayCount,activeCount,recent]=await Promise.all([
  User.countDocuments({role:"student"}),User.countDocuments({role:"teacher"}),AttendanceSession.countDocuments(),Attendance.countDocuments(),
  Attendance.countDocuments({scannedAt:{$gte:new Date(new Date().setHours(0,0,0,0))}}),
  AttendanceSession.countDocuments({active:true,expiresAt:{$gt:new Date()}}),
  Attendance.find().sort({scannedAt:-1}).limit(10).populate("student","name studentId").populate("attendanceSession","title")
 ]);
 res.render("superadmin",{title:"Administrator Dashboard",studentCount,teacherCount,sessionCount,attendanceCount,todayCount,activeCount,recent});
});
app.get("/admin/teachers",requireAdmin,async(req,res)=>{const teachers=await User.find({role:"teacher"}).sort({name:1});res.render("admin-teachers",{title:"Teacher Accounts",people:teachers,kind:"teachers"});});
app.get("/admin/students",requireAdmin,async(req,res)=>{const students=await User.find({role:"student"}).sort({name:1});res.render("students",{title:"All Students",students});});
app.get("/admin/reports",requireAdmin,async(req,res)=>{const records=await Attendance.find().sort({scannedAt:-1}).populate("student","name studentId email").populate("attendanceSession","title");res.render("reports",{title:"System Attendance Reports",records,reportBase:"/admin"});});
app.get("/admin/reports.csv",requireAdmin,async(req,res)=>{
 const records=await Attendance.find().sort({scannedAt:-1}).populate("student","name studentId email").populate("attendanceSession","title");
 const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const lines=[["Student","Student ID","Email","Session","Date and time","Status"],...records.map(r=>[r.student?.name,r.student?.studentId,r.student?.email,r.attendanceSession?.title,r.scannedAt.toISOString(),r.status])];
 res.setHeader("Content-Type","text/csv");res.setHeader("Content-Disposition","attachment; filename=system-attendance-report.csv");res.send(lines.map(row=>row.map(q).join(",")).join("\n"));
});
app.get("/teacher/students",requireTeacher,async(req,res)=>{const students=await User.find({role:"student"}).sort({name:1});res.render("students",{title:"Student Directory",students});});

app.get("/teacher/sessions",requireTeacher,async(req,res)=>{const sessions=await AttendanceSession.find().sort({createdAt:-1});res.render("sessions",{title:"QR Attendance Sessions",sessions});});

app.post("/teacher/sessions",requireTeacher,async(req,res)=>{
 try {const title=(req.body.title||"").trim();const minutes=Math.min(Math.max(parseInt(req.body.minutes,10)||15,1),240);
  if(!title){setMessage(req,"Enter a class or session title.");return res.redirect("/teacher/sessions");}
  const token=crypto.randomBytes(24).toString("hex");const expiresAt=new Date(Date.now()+minutes*60000);
  const created=await AttendanceSession.create({title,token,expiresAt,createdBy:req.session.user.id});
  const baseUrl=(process.env.APP_URL||`${req.protocol}://${req.get("host")}`).replace(/\/$/,"");
  const scanUrl=`${baseUrl}/scan?token=${token}`;const qrDataUrl=await QRCode.toDataURL(scanUrl,{width:340,margin:2});
  res.render("qr",{title:"Attendance QR Code",attendanceSession:created,qrDataUrl,scanUrl});
 } catch(err){console.error(err);setMessage(req,"Could not create attendance session.");res.redirect("/teacher/sessions");}
});
app.post("/teacher/sessions/:id/close",requireTeacher,async(req,res)=>{await AttendanceSession.findByIdAndUpdate(req.params.id,{active:false});setMessage(req,"Attendance session closed.");res.redirect("/teacher/sessions");});
app.get("/teacher/reports",requireTeacher,async(req,res)=>{const records=await Attendance.find().sort({scannedAt:-1}).populate("student","name studentId email").populate("attendanceSession","title");res.render("reports",{title:"Attendance Reports",records});});

app.get("/teacher/reports.csv",requireTeacher,async(req,res)=>{
 const records=await Attendance.find().sort({scannedAt:-1}).populate("student","name studentId email").populate("attendanceSession","title");
 const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const lines=[["Student","Student ID","Email","Session","Date and time","Status"],...records.map(r=>[r.student?.name,r.student?.studentId,r.student?.email,r.attendanceSession?.title,r.scannedAt.toISOString(),r.status])];
 res.setHeader("Content-Type","text/csv");res.setHeader("Content-Disposition","attachment; filename=attendance-report.csv");res.send(lines.map(row=>row.map(q).join(",")).join("\n"));
});
app.get("/student",requireStudent,async(req,res)=>{
 const records=await Attendance.find({student:req.session.user.id}).sort({scannedAt:-1}).populate("attendanceSession","title");
 const activeSessions=await AttendanceSession.find({active:true,expiresAt:{$gt:new Date()}}).sort({createdAt:-1});
 res.render("student",{title:"Student Dashboard",records,activeSessions});
});
app.get("/scan",requireStudent,async(req,res)=>{
 const attendanceSession=await AttendanceSession.findOne({token:req.query.token||"",active:true,expiresAt:{$gt:new Date()}});
 if(!attendanceSession)return res.status(400).render("error",{title:"QR code unavailable",message:"This QR code is invalid, closed, or expired. Please ask your teacher for a current code."});
 try {await Attendance.create({student:req.session.user.id,attendanceSession:attendanceSession._id,status:"Present"});res.render("scan-success",{title:"Attendance Recorded",attendanceSession});}
 catch(err){if(err.code===11000)return res.render("error",{title:"Already recorded",message:"Your attendance for this session has already been recorded."});console.error(err);res.status(500).render("error",{title:"Error",message:"Could not record attendance. Please try again."});}
});
app.get("/student/scan",requireStudent,(req,res)=>res.render("scanner",{title:"Scan QR Code"}));
async function start(){if(!process.env.MONGODB_URI){console.error("Missing MONGODB_URI in environment.");process.exit(1);}await mongoose.connect(process.env.MONGODB_URI);console.log("Connected to MongoDB");app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));}
start().catch(err=>{console.error("Startup error:",err);process.exit(1);});
