//---------------------------------------------------------------------------
/// Library & File Imports
//---------------------------------------------------------------------------
const express = require("express");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const exphbs = require("express-handlebars");
const authData = require("./auth-service");
const clientSessions = require("client-sessions");

const storeService = require("./store-service");

//---------------------------------------------------------------------------
/// Server Setup
//---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 8080;

//---------------------------------------------------------------------------
/// Cloudinary Setup
//---------------------------------------------------------------------------
cloudinary.config({
  cloud_name: "dh0zkzgpk",
  api_key: "645712828111368",
  api_secret: "FJuB75gHkggMxdNmaG8EPSehV5w",
});
const upload = multer();

//---------------------------------------------------------------------------
/// Custom Middleware
//---------------------------------------------------------------------------
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "views"));

app.use(function (req, res, next) {
  let route = req.path.substring(1);
  app.locals.activeRoute =
    "/" +
    (isNaN(route.split("/")[1])
      ? route.replace(/\/(?!.*)/, "")
      : route.replace(/\/(.*)/, ""));
  app.locals.viewingCategory = req.query.category;
  next();
});

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    defaultLayout: "main",
    helpers: {
      navLink: function (url, options) {
        return (
          '<li class="nav-item"><a ' +
          (url == app.locals.activeRoute
            ? ' class="nav-link active"'
            : 'class="nav-link"') +
          ' href="' +
          url +
          '">' +
          options.fn(this) +
          "</a></li>"
        );
      },
      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3)
          throw new Error("Handlebars Helper equal needs 2 parameters");
        if (lvalue != rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      },
      formatDate: function (dateObj) {
        let year = dateObj.getFullYear();
        let month = (dateObj.getMonth() + 1).toString();
        let day = dateObj.getDate().toString();
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      },
    },
  })
);

app.set("view engine", "hbs");

app.use(clientSessions({
  cookieName: "session",
  secret: "web322",
  duration: 24 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
      res.redirect("/login");
  } else {
      next();
  }
}

//---------------------------------------------------------------------------
/// Default Route
//---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.redirect("shop");
});

app.get("/about", (req, res) => {
  res.render("about");
});

//---------------------------------------------------------------------------
/// Login Routes
//---------------------------------------------------------------------------
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  authData.registerUser(req.body).then(() => {
      res.render("register", { successMessage: "User created" });
  }).catch((err) => {
      res.render("register", { errorMessage: err, userName: req.body.userName });
  });
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authData.checkUser(req.body).then((user) => {
      req.session.user = {
          userName: user.userName,
          email: user.email,
          loginHistory: user.loginHistory
      };
      res.redirect("/items");
  }).catch((err) => {
      res.render("login", { errorMessage: err, userName: req.body.userName });
  });
});

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render("userHistory");
});




//---------------------------------------------------------------------------
/// Shop Routes
//---------------------------------------------------------------------------
app.get("/shop", async (req, res) => {
  let viewData = {};

  try {
    let items = [];
    if (req.query.category) {
      items = await storeService.getPublishedItemsByCategory(
        req.query.category
      );
    } else {
      items = await storeService.getPublishedItems();
    }
    items.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    let post = items[0];
    viewData.items = items;
    viewData.item = post;
  } catch (err) {
    viewData.message = "No results";
  }

  try {
    let categories = await storeService.getCategories();
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "No results";
  }
  res.render("shop", { data: viewData });
});

app.get("/shop/:id", async (req, res) => {
  let viewData = {};

  try {
    const item = await storeService.getItemById(req.params.id);
    if (!item || !item.published) {
      viewData.message = `No results for item with ID: ${req.params.id}`;
    } else {
      viewData.item = item;

      const category = await storeService.getCategoryById(item.categoryID);
      viewData.item.categoryName = category ? category.categoryName : "Unknown";
    }
  } catch (err) {
    viewData.message = "Error fetching item details";
  }

  try {
    const items = req.query.category
      ? await storeService.getPublishedItemsByCategory(req.query.category)
      : await storeService.getPublishedItems();
    items.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    viewData.items = items;
  } catch (err) {
    viewData.message = "No results for items";
  }

  try {
    const categories = await storeService.getCategories();
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "No results for categories";
  }

  res.render("shop", { data: viewData });
});

//---------------------------------------------------------------------------
/// Item Routes
//---------------------------------------------------------------------------
app.get("/items", ensureLogin ,async (req, res) => {
  try {
    let items;
    if (req.query.category) {
      items = await storeService.getItemsByCategory(req.query.category);
    } else if (req.query.minDate) {
      items = await storeService.getItemsByMinDate(req.query.minDate);
    } else {
      items = await storeService.getAllItems();
    }
    const categories = await storeService.getCategories();
    const categoryMap = categories.reduce((map, category) => {
      map[category.categoryID] = category.categoryName;
      return map;
    }, {});
    items = items.map((item) => ({
      ...item,
      categoryName: categoryMap[item.categoryID] || "Unknown",
    }));

    res.render("items", { items });
  } catch (err) {
    res.render("items", { message: "No results" });
  }
});

app.get("/items/add", async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render("additem", { categories });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Unable to fetch categories: " + err.message });
  }
});

app.post("/items/add", ensureLogin ,upload.single("featureImage"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        });

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      let result = await streamUpload(req);
      console.log(result);
      return result;
    }

    upload(req).then((uploaded) => {
      processItem(uploaded.url);
    });
  } else {
    processItem("");
  }

  function processItem(imageUrl) {
    req.body.featureImage = imageUrl;
    req.body.categoryID = parseInt(req.body.categoryID, 10);

    storeService
      .addItem(req.body)
      .then(() => res.redirect("/items"))
      .catch((err) => res.status(500).json({ message: err }));
  }
});

app.get("/item/:id", (req, res) => {
  storeService
    .getItemById(req.params.id)
    .then((data) => {
      if (data) res.render("item", { item: data });
      else res.status(404).send("Item Not Found");
    })
    .catch((err) => {
      res.status(500).send("Unable to retrieve item");
    });
});

app.get("/items/delete/:id", (req, res) => {
  storeService
    .deleteItemById(req.params.id)
    .then(() => res.redirect("/items"))
    .catch((err) =>
      res.status(500).send("Unable to Remove Item / Item not found")
    );
});

//---------------------------------------------------------------------------
/// Category Routes
//---------------------------------------------------------------------------
app.get("/categories", ensureLogin , (req, res) => {
  storeService
    .getCategories()
    .then((data) => {
      if (data.length > 0) res.render("categories", { categories: data });
      else res.render("categories", { message: "no results" });
    })
    .catch((err) => {
      res.render("categories", { message: "no results" });
    });
});

app.get("/categories/add", ensureLogin , (req, res) => {
  res.render("addCategory");
});

app.post("/categories/add", ensureLogin ,(req, res) => {
  storeService
    .addCategory(req.body)
    .then(() => {
      res.redirect("/categories");
    })
    .catch((err) => {
      res.status(500).send("Unable to add category");
    });
});

app.get("/categories/delete/:id", ensureLogin ,(req, res) => {
  storeService
    .deleteCategoryById(req.params.id)
    .then(() => {
      res.redirect("/categories");
    })
    .catch((err) => {
      res.status(500).send("Unable to remove category / Category not found");
    });
});

//---------------------------------------------------------------------------
/// 404 Error Handler
//---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render("404");
});

//---------------------------------------------------------------------------
/// Start Server
//---------------------------------------------------------------------------
storeService
  .initialize()
  .then(authData.initialize)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Express http server listening on: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.log(`Unable to start server: ${err}`);
  });