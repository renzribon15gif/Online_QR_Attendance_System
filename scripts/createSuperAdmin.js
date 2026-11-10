require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
async function main(){
 const {MONGODB_URI,SUPERADMIN_NAME,SUPERADMIN_EMAIL,SUPERADMIN_PASSWORD}=process.env;
 if(!MONGODB_URI||!SUPERADMIN_NAME||!SUPERADMIN_EMAIL||!SUPERADMIN_PASSWORD) throw new Error("Set MONGODB_URI, SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env first.");
 if(SUPERADMIN_PASSWORD.length<12) throw new Error("SUPERADMIN_PASSWORD must be at least 12 characters.");
 await mongoose.connect(MONGODB_URI);
 const email=SUPERADMIN_EMAIL.toLowerCase().trim();
 const existing=await User.findOne({email});
 const studentId=existing?.studentId || "ADMIN-001";
 await User.findOneAndUpdate({email},{name:SUPERADMIN_NAME,studentId,email,passwordHash:await bcrypt.hash(SUPERADMIN_PASSWORD,12),role:"admin"},{upsert:true,new:true,setDefaultsOnInsert:true});
 console.log("Separate administrator account created/updated:",email);
 await mongoose.disconnect();
}
main().catch(async err=>{console.error(err);try{await mongoose.disconnect();}catch{}process.exit(1);});
