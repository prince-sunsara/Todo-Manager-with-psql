/* eslint-disable no-unused-vars */
const express = require("express");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const user = require("./models/user");
const bcrypt = require("bcrypt");
const saltRounds = 10;

// FOR CONNECT-FLASH
const flash = require("connect-flash");
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"])); // use any 32 char string i.e. 123456789iamasecret987654321look

app.use(
  session({
    secret: "my-super-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, //24hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ENDPOINTS FOR PASSPORT STRETARGY
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({
        where: {
          email: username,
        },
      })
        .then(async (user) => {
          // console.log(user.email);
          if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
              return done(null, user);
            } else {
              return done(null, false, {
                message: "Invalid password",
              });
            }
          } else {
            return done(null, false, {
              message: "With This email user doesn't exists",
            });
          }
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

// SET EJS AS VIEW ENGINE
app.set("view engine", "ejs");

// FOR ALL JS, CSS JOINING
app.use(express.static(path.join(__dirname, "public")));

// FLASH-CONNECT 
app.use((request, response, next) => {
  const data = request.flash();
  response.locals.messages = data;
  next();
});

// ENDPOINTS FOR TODOS
app.get("/", async (request, response) => {
  if (request.session.passport) {
    response.redirect("/todos");
  } else {
    response.render("index", {
      title: "Todo application",
      csrfToken: request.csrfToken(),
    });
  }
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const overdue = await Todo.overDue(loggedInUser);
    const dueToday = await Todo.dueToday(loggedInUser);
    const dueLater = await Todo.dueLater(loggedInUser);
    const completedItems = await Todo.completedItems(loggedInUser);
    if (request.accepts("html")) {
      response.render("todosPage", {
        title: "Todo application",
        overdue,
        dueToday,
        dueLater,
        completedItems,
        user: request.user.firstName,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        overdue,
        dueToday,
        dueLater,
        completedItems,
      });
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("Creating a todo", request.body);
    console.log(request.user);
    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        completed: false,
        userId: request.user.id,
      });
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      console.log(error.name);
      if (error.name == "SequelizeValidationError") {
        error.errors.forEach((e) => {
          if (e.message == "Title length must be greater than 5") {
            request.flash(
              "error",
              "Title length must be greater than or equal to 5"
            );
          }
          if (e.message == "Please enter a valid date") {
            request.flash("error", "Please enter valid date");
          }
        });
        return response.redirect("/todos");
      } else {
        return response.status(422).json(error);
      }
    }
  }
);

app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("We have to update a Todo with ID: ", request.params.id);
    const todo = await Todo.findByPk(request.params.id);
    try {
      const updatedTodo = await todo.setCompletionStatus(
        request.body.completed
      );
      return response.json(updatedTodo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("We have to delete a Todo with ID: ", request.params.id);
    try {
      await Todo.remove(request.params.id, request.user.id);
      return response.json({ success: true });
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

// ENDPOINTS FOR USERS
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Sign up",
    csrfToken: request.csrfToken(),
  });
});

app.get("/login", (request, response) => {
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});

app.get("/signout", (request, response, next) => {
  // SINGOUT
  request.logOut((err) => {
    if (err) return next(err);
    response.redirect("/");
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    console.log(request.user);
    response.redirect("/todos");
  }
);

app.post("/users", async (request, response) => {
  // HAS PASSWORD USING BCRYPT
  const hasedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hasedPwd);
  // CREATE USER HERE
  try {
    const user = await User.create({
      firstName: request.body.firstName,
      flastName: request.body.lastName,
      email: request.body.email,
      password: hasedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/todos");
    });
  } catch (error) {
    console.log(error);
    console.log(error.name);
    if (error.name == "SequelizeValidationError") {
      error.errors.forEach((e) => {
        if (e.message == "Please provide a firstName") {
          request.flash("error", "Please provide a firstName");
        }
        if (e.message == "Please provide email_id") {
          request.flash("error", "Please provide email_id");
        }
      });
      return response.redirect("/signup");
    } else if (error.name == "sequelizeUniqueConstraintError") {
      error.errors.forEach((e) => {
        if (e.message == "email must be unique") {
          request.flash("error", "User with this email already exists");
        }
      });
      return response.redirect("/singup");
    } else {
      return response.status(422).json(error);
    }
  }
});

module.exports = app;
