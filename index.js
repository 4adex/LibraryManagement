const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const userRouter = require("./routes/user");
const booksRouter = require("./routes/books");
const adminRouter = require("./routes/admin");
const path = require("path");
const cookieParser = require("cookie-parser");
const {checkForAuthenticationCookie} = require("./middlewares/authentication");
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;


//setting view engine
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));


//MIDDLEWARES
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'hawkeye',
  resave: false,
  saveUninitialized: true
}));



//ROUTES AND ROUTERS
app.use(checkForAuthenticationCookie("token"));
app.use(express.static(path.resolve("./public")));
app.use("/", userRouter);
app.use("/",booksRouter);

//NEED WORK ON AUTHORIZATION
app.use("/",adminRouter);
app.get("/test", (req,res)=>{
  return res.render("home");
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
