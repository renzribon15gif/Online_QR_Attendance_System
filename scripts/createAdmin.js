require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const User=require("../src/models/User");
async function main(){
 const {MONGODB_URI,ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
 if(!MONGODB_URI||!ADMIN_NAME||!ADMIN_EMAIL||!ADMIN_PASSWORD)throw new Error("Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
 await mongoose.connect(MONGODB_URI);const email=ADMIN_EMAIL.toLowerCase().trim();
 const existing=await User.findOne({email});
 const studentId=existing?.studentId||"TEACHER-001";
 await User.findOneAndUpdate({email},{name:ADMIN_NAME,studentId,email,passwordHash:await bcrypt.hash(ADMIN_PASSWORD,12),role:"teacher"},{upsert:true,new:true,setDefaultsOnInsert:true});
 console.log("Teacher account created/updated:",email);await mongoose.disconnect();
}
main().catch(err=>{console.error(err);process.exit(1);});
