import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import mysql from "mysql2";
import bcrypt from "bcryptjs";

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

// ตั้งค่าการเชื่อมต่อ MySQL
const conn = mysql.createConnection({
  host: process.env.LOCALHOSTDB,
  user: process.env.USERDB,
  password: process.env.PASSDB,
  database: process.env.NAMEDB,
});

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
const deleteSql = (tbname, wheres) => {
  const where = wheres.join(", ");

  const sql = `DELETE FROM ${tbname} WHERE ${where}`;
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
      const sql = "SELECT user_id, user_password FROM user WHERE user_email = ?";
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
              socket.emit('setDisBtn', true);
              setTimeout(() => {
                socket.emit('setDisBtn', false);
                socket.emit('signIned', user_id);
              }, 2000);
            } else {
              socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ`, "error");
            }
          });
        }else{
          socket.emit("showAlert", `ບໍ່ພົບຜູ້ໃຊ້ນີ້`, "error");
        }
      });
      return;
    } else {
      const sql = "SELECT user_id, user_password FROM user WHERE user_username = ?";
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
              socket.emit('setDisBtn', true);
              setTimeout(() => {
                socket.emit('setDisBtn', false);
                socket.emit('signIned', user_id);
              }, 2000);
            } else {
              socket.emit("showAlert", `ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ`, "error");
            }
          });
        }else{
          socket.emit("showAlert", `ບໍ່ພົບຜູ້ໃຊ້ນີ້`, "error");
        }
      });
      return;
    }
  });

  //toHome
  socket.on('toHome', (cookieUser)=>{
    const userId = socket.handshake.query.user_id; // ดึงค่า user_id จาก query
    console.log('User connected with ID:', userId);

    const sql = 'SELECT * FROM user WHERE user_id = ?';
    conn.query(sql, [cookieUser], (err, sult)=>{
      if(err){
        
      }
      if(sult){
        const pathImg = `./img/${sult[0].user_img}`;
        socket.emit('showTbUser', pathImg);
      }
    })
  })

  socket.on("disconnect", () => {
    console.log("User disconected", socket.id); // แสดงข้อความเมื่อผู้ใช้ตัดการเชื่อมต่อ
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
