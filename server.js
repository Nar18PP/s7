import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import mysql from "mysql2";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import sharp from "sharp"; // นำเข้า sharp
import fs, { accessSync } from "fs";

// Middleware เพื่อให้ Express รู้จัก JSONd
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
dotenv.config();
const storage = multer.memoryStorage(); // ใช้ memoryStorage เพื่อจัดการไฟล์ใน RAM
let fileName;
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // จำกัดขนาดไฟล์ที่ 5MB
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedFileTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb("Error: Images Only!");
    }
  },
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    // ตรวจสอบว่ามีไฟล์ถูกอัปโหลด
    if (!req.file) {
      return res.status(400).send("No file uploaded!");
    }
    fileName = `${Date.now()}.webp`;
    // ตั้งค่าที่จะบันทึกไฟล์เป็น WEBP
    const outputFilePath = path.join("img", `${Date.now()}.webp`);
    
    // แปลงภาพและบันทึก
    await sharp(req.file.buffer).toFile(outputFilePath);
    
    res.send("Image uploaded and converted to WEBP successfully!");
  } catch (err) {
    console.error("Error uploading image:", err);
    res.status(400).send("Error uploading image!");
  }
});

// เส้นทาง API สำหรับลบไฟล์
app.delete("/delete-image/:filename", (req, res) => {
  let filename = req.params.filename;
  
  // ลบเครื่องหมาย ':' ออกจากชื่อไฟล์หากมี
  filename = filename.replace(/:/g, "");
  
  const imagePath = path.join("img", filename);
  
  // ตรวจสอบว่าไฟล์มีอยู่หรือไม่
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ message: "File not found" });
  }
  
  // ลบไฟล์
  fs.unlink(imagePath, (err) => {
    if (err) {
      return res
      .status(500)
      .json({ message: "Error deleting file", error: err });
    }
    res.status(200).json({ message: "File deleted successfully" });
  });
});

// ให้บริการไฟล์สถิตจากโฟลเดอร์ img
app.use("/img", express.static(path.join("./img")));

// ตั้งค่าการเชื่อมต่อ MySQL
const conn = mysql.createConnection({
  host: process.env.LOCALHOSTDB,
  user: process.env.USERDB,
  password: process.env.PASSDB,
  database: process.env.NAMEDB,
});
console.log('LOCALHOSTDB: '+process.env.LOCALHOSTDB)
console.log('USERDB: '+process.env.USERDB)
console.log('PASSDB: '+process.env.PASSDB)
console.log('NAMEDB: '+process.env.NAMEDB)

// เชื่อมต่อกับฐานข้อมูล
conn.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err.message);
    return;
  }
  console.log("Connected to MySQL");
});

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// ฟังก์ชันสำหรับแฮชรหัสผ่าน
async function hashPassword(password) {
  const saltRounds = 12; // จำนวนรอบในการสร้าง salt (ค่าแนะนำคือ 10 ขึ้นไป)
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}
// ฟังก์ชันสำหรับตรวจสอบรหัสผ่าน
async function comparePassword(inputPassword, hashedPassword) {
  const match = await bcrypt.compare(inputPassword, hashedPassword);
  return match; // จะคืนค่าเป็น true หากตรงกัน และ false หากไม่ตรงกัน
}

let inter1 = {};
let interval1 = {};
let countUser1 = {};

const insertSql = (tableName, columns, values) => {
  const columnsStr = columns.join(", "); // รวมชื่อคอลัมน์เป็นสตริง
  const valuesStr = values.join(", "); // จัดรูปแบบและรวมค่าต่าง ๆ เป็นสตริงพร้อมฟอร์แมต

  const sql = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr});`;
  return sql;
};
const selectSql = (tbname, columns, wheres) => {
  const column = columns.join(", ");
  const where = wheres.join(", ");
  const sql = `SELECT ${column} FROM ${tbname} WHERE ${where}`;
  return sql;
};
const updateSql = (tbname, columns, values, wheres) => {
  const column = columns.join(", ");
  const value = values.join(", ");
  const where = wheres.join(", ");

  const sql = `UPDATE ${tbname} SET ${column} = ${value} WHERE ${where}`;
  return sql;
};

// กำหนดค่า transporter สำหรับ nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // หรือใช้ 'smtp.gmail.com' หากไม่ระบุ service
  auth: {
    user: process.env.EMAIL_USER, // ที่อยู่อีเมลของคุณ
    pass: process.env.EMAIL_PASS, // รหัสผ่านหรือ App password ของคุณ
  },
});
// ฟังก์ชันส่งอีเมล
const sendEmail = async (email, socket, status) => {
  const otp = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;

  const mailOptions1 = {
    from: `Foraling <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `ຢືນຢັນ OTP ຂອງທ່ານ`,
    text: `ລະຫັດ OTP ຂອງທ່ານຄື: ${otp}`,
  };
  const mailOptions2 = {
    from: `Foraling <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `ຢືນຢັນ OTP ຂອງທ່ານສຳລັບປ່ຽນລະຫັດຜ່ານ`,
    text: `ລະຫັດ OTP ຂອງທ່ານຄື: ${otp}`,
  };
  try {
    if (status === "sendOtpRegister") {
      await transporter.sendMail(mailOptions1);
      socket.emit("showAlert", `ສົ່ງລະຫັດ OTP ໄປທີ່ ${email}`, "success");
      countdown1(email, socket);
      socket.emit("sendMailed", email);
      addOtp(email, otp, socket);
      socket.emit("setBtnSend", false);
    } else if (status === "sendOtpResetPwd") {
      await transporter.sendMail(mailOptions2);
      socket.emit("showAlert", `ສົ່ງລະຫັດ OTP ໄປທີ່ ${email}`, "success");
      countdown1(email, socket);
      socket.emit("sendMailed", email);
      const sql = updateSql("user", ["user_otp"], ["?"], ["user_email = ?"]);
      conn.query(sql, [otp, email], (err, sult) => {
        if (err) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
      });
      socket.emit("setBtnSend", false);
    }
  } catch (err) {
    socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
    socket.emit("setBtnSend", false);
  }
};

const countdown1 = (email, socket) => {
  if (interval1[email]) {
    return;
  }
  countUser1[email] = 60;

  interval1[email] = setInterval(() => {
    countUser1[email] -= 1;
    console.log(countUser1);
    socket.emit("countSendOtp", countUser1[email]);
    if (countUser1[email] <= 0) {
      socket.emit("countSendOtp", "Send");
      delOtp(email, socket);
      const sql = updateSql("user", ["user_otp"], ["?"], ["user_email = ?"]);
      conn.query(sql, ["", email], (err, sult) => {
        if (err) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
      });
      clearInterval(interval1[email]);
      interval1[email] = null;
      delete interval1[email];
      delete countUser1[email];
    }
  }, 1000);
};

const addOtp = (email, otp, socket) => {
  const sql = "INSERT INTO user (user_email, user_otp) values(?, ?)";
  conn.query(sql, [email, otp], (err, result) => {
    if (err) {
      socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
    }
  });
};
const delOtp = (email, socket) => {
  const sql = "DELETE FROM user WHERE user_email = ? AND user_fname IS NULL";
  conn.query(sql, [email], (err, result) => {
    if (err) {
      socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
    } else if (result) {
    }
  });
};

app.get("/api/products", (req, res) => {
  const products = [
    {
      id: 1,
      name: "ຜັດໄກ່23",
      heart: 957,
      price: 67,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTzb0IFD9i42VcxKBRLdtzQsQHEKrXWJuqBEw&s",
    },
    {
      id: 2,
      name: "ເບີເກີ່",
      heart: 1520,
      price: 38,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQBZL-_s71i1m6RLSIIfxfg0D9rR91Z8MLLbQ&s",
    },
    {
      id: 3,
      name: "ຍຳທະເລ",
      heart: 541,
      price: 163,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUPZ8Hv38DtbZs2gqhTLkKT-MgbmHTHpdHVw&s",
    },
    {
      id: 4,
      name: "ຍຳສະລັດ",
      heart: 5971,
      price: 29,
      img: "https://images.pexels.com/photos/2097090/pexels-photo-2097090.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 5,
      name: "ສະມູດຕີ່",
      heart: 1672,
      price: 54,
      img: "https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 6,
      name: "ເຄັກຊອກໂກແລັດ",
      heart: 541,
      price: 210,
      img: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 7,
      name: "ຊີ້ນໝາ",
      heart: 662,
      price: 56,
      img: "https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 8,
      name: "ຊູຊິ",
      heart: 25563,
      price: 156,
      img: "https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 9,
      name: "ຊີ້ນງົວ",
      heart: 954,
      price: 84,
      img: "https://images.pexels.com/photos/793785/pexels-photo-793785.jpeg?auto=compress&cs=tinysrgb&w=600https://images.pexels.com/photos/769290/pexels-photo-769290.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
    {
      id: 10,
      name: "ໄຂ່ຕົ້ມ",
      heart: 2359,
      price: 59,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUPZ8Hv38DtbZs2gqhTLkKT-MgbmHTHpdHVw&s",
    },
    {
      id: 11,
      name: "ພິດຊ່າ",
      heart: 587,
      price: 85,
      img: "https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg?cs=srgb&dl=pexels-vince-2147491.jpg&fm=jpg",
    },
  ];
  res.json(products);
});

//ດືງຮ້ານຄ້າທັງໝົດ
const getAllStore = async (socket, userId) => {
  const sql1 = "select * from stores ORDER BY store_heart DESC;";
  const sql2 = "select * from user_heart where user_id = ?";
  conn.query(sql1, (err, sult) => {
    if (sult) {
      socket.emit("getAllStore", sult);
    }
  });
  conn.query(sql2, [userId], (err, sult) => {
    if (sult.length >= 1) {
      const sql =
        "SELECT * FROM user_heart uh JOIN stores s ON uh.store_id = s.store_id WHERE uh.user_id = ? ORDER BY s.store_id DESC;";
      conn.query(sql, [userId], (err1, sult1) => {
        socket.emit("getHeartStore", sult1);
      });
    }
  });
};
const kodJai = (userId, socket, storeId) => {
  const sqlcheck =
    "select store_id from user_heart where user_id = ? and store_id = ?";
  conn.query(sqlcheck, [userId, storeId], (err, sult) => {
    if (sult.length >= 1) {
      console.log(444);
    } else {
      const sql = "insert into user_heart (user_id, store_id) values(?, ?)";
      conn.query(sql, [userId, storeId], (err1, sult1) => {
        if (sult1) {
        }
      });
    }
  });
};

io.on("connection", (socket) => {
  console.log(socket.id);

  socket.on("sendOtp", (email, status) => {
    if (!email) {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນກ່ອນ`, "error");
      return;
    }
    if (!validateEmail(email)) {
      socket.emit("showAlert", `ອີເມວບໍ່ຖືກຕ້ອງ`, "error");
      return;
    }
    if (status === "sendOtpRegister") {
      const sql = selectSql("user", ["user_email"], ["user_email = ?"]);
      conn.query(sql, [email], (err, result) => {
        if (result.length >= 1) {
          socket.emit("showAlert", `ມີຜູ້ໃຊ້ອີເມວນີ້ແລ້ວ`, "error");
          socket.emit("setBtnSend", false);
          return;
        }
        socket.emit("setBtnSend", true);
        sendEmail(email, socket, status);
      });
    } else if (status === "sendOtpResetPwd") {
      const sql = selectSql(
        "user",
        ["user_email, user_fname"],
        ["user_email = ? AND user_fname IS NOT NULL"]
      );
      conn.query(sql, [email], (err, sult) => {
        if (err) {
          socket.emit("setBtnSend", false);
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
        if (sult.length >= 1) {
          socket.emit("setBtnSend", true);
          sendEmail(email, socket, status);
        } else {
          socket.emit("setBtnSend", false);
          socket.emit("showAlert", `ອີເມວບໍ່ຖືກຕ້ອງ`, "error");
        }
      });
    }
  });

  socket.on("requestCountSendOtp1", (email) => {
    if (countUser1[email]) {
      if (inter1[email]) {
        clearInterval(inter1[email]);
        inter1[email] = null;
        delete inter1[email];
      }

      inter1[email] = setInterval(() => {
        socket.emit("countSendOtp", countUser1[email]);
        if (countUser1[email] <= 1) {
          setTimeout(() => {
            socket.emit("countSendOtp1", "Send");
            delOtp(email, socket);
          }, 1000);

          clearInterval(inter1[email]);
          inter1[email] = null;
          delete inter1[email];
        }
      }, 200);
    }
  });
  socket.on("checkOtp", (email, otp) => {
    if (!email || !otp) {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນໃຫ້ຄົບ`, "error");
      return;
    }
    const sql =
      "SELECT user_email FROM user WHERE user_email = ? AND user_otp = ?";
    conn.query(sql, [email, otp], (err, result) => {
      if (err) {
        if (err) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
      }
      if (result.length >= 1) {
        socket.emit("checkOtped");
      } else {
        socket.emit("showAlert", `ລະຫັດ OTP ບໍ່ຖືກຕ້ອງ`, "error");
      }
    });
  });
  socket.on("inputUsername", (username, age) => {
    if (username && age) {
      if (username.length >= 3) {
        const sql = "SELECT user_username FROM user WHERE user_username = ?";
        conn.query(sql, [username], (err, result) => {
          if (err) {
            socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
          }
          if (result.length >= 1) {
            socket.emit("showAlert", `ມີຜູ້ໃຊ້ຊື່ນີ້ແລ້ວ`, "error");
          } else {
            socket.emit("inputUsernamed");
          }
        });
      } else {
        socket.emit("showAlert", `Username ຕ້ອງມີ 3 ຕົວຂື້ນໄປ`, "error");
      }
    } else {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນໃຫ້ຄົບ`, "error");
    }
  });
  socket.on("inputName", (fname, lname) => {
    if (fname && lname) {
      if (fname.length >= 3 && lname.length >= 3) {
        socket.emit("inputNamed");
      } else {
        socket.emit("showAlert", `ຕ້ອງມີ 3 ຕົວຂື້ນໄປ`, "error");
      }
    } else {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນໃຫ້ຄົບ`, "error");
    }
  });
  socket.on(
    "lastStep",
    (password1, password2, email, firstName, lastName, username, age) => {
      if (password1.length >= 6) {
        if (password1 === password2) {
          const sql = selectSql(
            "user",
            ["*"],
            ["user_email = ? AND user_fname IS NOT NULL"]
          );
          conn.query(sql, [email], (err, result) => {
            if (err) {
              socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
            }
            if (result.length >= 1) {
              socket.emit("showAlert", `ມີຜູ້ໃຊ້ອີເມວແລ້ວ`, "error");
            } else {
              const sql = selectSql("user", ["*"], [" user_username = ?"]);
              conn.query(sql, [username], (err, result) => {
                if (err) {
                  socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
                }
                if (result.length >= 1) {
                  socket.emit("showAlert", `ມີຜູ້ໃຊ້ Username ແລ້ວ`, "error");
                } else {
                  const sql = insertSql(
                    "user",
                    [
                      "user_fname",
                      "user_lname",
                      "user_username",
                      "user_age",
                      "user_email",
                      "user_password",
                    ],
                    ["?", "?", "?", "?", "?", "?"]
                  );
                  hashPassword(password1).then((hashedPassword) => {
                    conn.query(
                      sql,
                      [
                        firstName,
                        lastName,
                        username,
                        age,
                        email,
                        hashedPassword,
                      ],
                      (err, result) => {
                        if (err) {
                          console.log(err);
                          socket.emit(
                            "showAlert",
                            `ມີຂໍ້ຜິດພາດເກີດຂື້ນ${err}`,
                            "error"
                          );
                        }
                        if (result) {
                          socket.emit("showAlert", `ລົງທະບຽນສຳເລັດ`, "success");
                          socket.emit("setDisBtn", true);
                          if (interval1[email]) {
                            delOtp(email, socket);
                            clearInterval(interval1[email]);
                            interval1[email] = null;
                            delete countUser1[email];
                            delete interval1[email];
                          }
                          if (inter1[email]) {
                            clearInterval(inter1[email]);
                            inter1[email] = null;
                            delete inter1[email];
                          }
                          setTimeout(() => {
                            socket.emit("signUped");
                            socket.emit("setDisBtn", false);
                          }, 3000);
                        }
                      }
                    );
                  });
                }
              });
            }
          });
        } else {
          socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຄືກັນ`, "error");
        }
      } else {
        socket.emit("showAlert", `ລະຫັດຜ່ານຕ້ອງມີ 6 ຕົວຂື້ນໄປ`, "error");
      }
    }
  );
  socket.on("newPassword", (email, password1, password2) => {
    if (!password1 || !password2) {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນໃຫ້ຄົບ`, "error");
      return;
    }
    if (password1.length < 6) {
      socket.emit("showAlert", `ລະຫັດຜ່ານຕ້ອງມີ 6 ຕົວຂື້ນໄປ`, "error");
      return;
    }
    if (password1 !== password2) {
      socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຄືກັນ`, "error");
      return;
    }
    const sql = updateSql("user", ["user_password"], ["?"], ["user_email = ?"]);
    hashPassword(password1).then((hashedPassword) => {
      conn.query(sql, [hashedPassword, email], (e, s) => {
        if (e) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        } else if (s) {
          socket.emit("showAlert", `ປ່ຽນລະຫັດຜ່ານສຳເລັດແລ້ວ`, "success");
          socket.emit("setDisBtn", true);
          if (interval1[email]) {
            clearInterval(interval1[email]);
            interval1[email] = null;
            delete countUser1[email];
            delete interval1[email];
          }
          if (inter1[email]) {
            clearInterval(inter1[email]);
            inter1[email] = null;
            delete inter1[email];
          }
          setTimeout(() => {
            socket.emit("setDisBtn", false);
            socket.emit("changePwded");
          }, 2000);
        }
      });
    });
  });
  socket.on("onSignIn", (email, password) => {
    if (!email) {
      socket.emit("showAlert", `ປ້ອນຂໍ້ມູນກ່ອນ`, "error");
      return;
    }
    if (validateEmail(email)) {
      const sql =
        "SELECT user_id, user_password FROM user WHERE user_email = ?";
      conn.query(sql, [email], (err, sult) => {
        if (err) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
        if (sult.length >= 1) {
          const hashedPassword = sult[0].user_password;
          const user_id = sult[0].user_id;
          comparePassword(password, hashedPassword).then((isMatch) => {
            if (isMatch) {
              socket.emit("showAlert", `ເຂົ້າສູ່ລະບົບສຳເລັດແລ້ວ`, "success");
              socket.emit("setDisBtn", true);
              setTimeout(() => {
                socket.emit("setDisBtn", false);
                socket.emit("signIned", user_id);
              }, 2000);
            } else {
              socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ`, "error");
            }
          });
        } else {
          socket.emit("showAlert", `ບໍ່ພົບຜູ້ໃຊ້ນີ້`, "error");
        }
      });
      return;
    } else {
      const sql =
        "SELECT user_id, user_password FROM user WHERE user_username = ?";
      conn.query(sql, [email], (err, sult) => {
        if (err) {
          socket.emit("showAlert", `ມີຂໍ້ຜິດພາດເກີດຂື້ນ`, "error");
        }
        if (sult.length >= 1) {
          const hashedPassword = sult[0].user_password;
          const user_id = sult[0].user_id;
          comparePassword(password, hashedPassword).then((isMatch) => {
            if (isMatch) {
              socket.emit("showAlert", `ເຂົ້າສູ່ລະບົບສຳເລັດແລ້ວ`, "success");
              socket.emit("setDisBtn", true);
              setTimeout(() => {
                socket.emit("setDisBtn", false);
                socket.emit("signIned", user_id);
              }, 2000);
            } else {
              socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ`, "error");
            }
          });
        } else {
          socket.emit("showAlert", `ບໍ່ພົບຜູ້ໃຊ້ນີ້`, "error");
        }
      });
      return;
    }
  });

  //toHome
  socket.on("toHome", (cookieUser) => {
    const userId = socket.handshake.query.user_id; // ดึงค่า user_id จาก query
    console.log("User connected with ID:", userId);

    const sql = "SELECT * FROM user WHERE user_id = ?";
    conn.query(sql, [cookieUser], (err, sult) => {
      if (err) {
      }
      if (sult) {
        const pathImg = `/img/${sult[0].user_img}`;
        const username = `${sult[0].user_username}`;
        const coin = `${sult[0].user_coin}`;
        socket.emit("getImgUser", {
          pathImg: pathImg,
          userName: username,
          coin: coin,
        });
      }
    });

    socket.on('responseStore', ()=>{
      getAllStore(socket, userId);
    });

    socket.on("kodJai", (storeId) => {
      kodJai(userId, socket, storeId);
    });

    socket.on("changeImg", () => {
      let old_img;
      const sql1 = "select user_img from user where user_id = ?";
      conn.query(sql1, [userId], (err, sult) => {
        if (sult) {
          old_img = sult[0].user_img;
          const sql = "update user set user_img = ? where user_id = ?";
          conn.query(sql, [fileName, userId], (err1, sult1) => {
            if (err1) {
              console.log(err);
            }
            if (sult1) {
              // กำหนดเส้นทางไฟล์ที่จะลบ
              socket.emit("changeimged", "/img/" + fileName);

              if (old_img === "userdefault.svg") {
                return;
              }
              const filePath = path.join("img", old_img);
              // ใช้ fs.unlink เพื่อลบไฟล์
              fs.unlinkSync(filePath);
            }
          });
        }
      });
    });
    socket.on('requestSendCm1', (inputComment, storeId, getTimeNow)=>{
      const sqlGetNameUser = 'select user_username from user where user_id = ?';
      conn.query(sqlGetNameUser, [userId], (err, sult)=>{
        if(sult){
          const sql = 'insert into comment (t_name, t_data, user_id, t_datetime, store_id) values(?, ?, ?, ?, ?)';
          conn.query(sql, [sult[0].user_username, inputComment, userId, getTimeNow, storeId], (err1, sult1)=>{
            socket.emit('responseSended')
          });
        }
        if(err){
          console.log(err)
        }
      })
    })
    socket.on('requestComment', (storeId)=>{
      const sql = 'SELECT user.user_img, comment.t_id, comment.t_name, comment.t_data, comment.t_datetime FROM comment JOIN user ON comment.user_id = user.user_id WHERE comment.store_id = ? order by comment.t_id desc;';
      conn.query(sql, [storeId], (err,sult)=>{
        if(sult.length >= 1){
          socket.emit('responseComment', sult)
        }
      })
    })
  });

  socket.on("disconnect", () => {
    console.log("User disconected", socket.id); // แสดงข้อความเมื่อผู้ใช้ตัดการเชื่อมต่อ
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
