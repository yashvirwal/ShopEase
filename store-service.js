// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
const Sequelize = require("sequelize");
const pg = require("pg");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
let sequelize = new Sequelize("SenecaDB", "SenecaDB_owner", "6KEOFPwGNS2d", {
  host: "ep-small-lab-a5ijyo19.us-east-2.aws.neon.tech",
  dialect: "postgres",
  dialectModule: pg,
  port: 5432,
  dialectOptions: {
    ssl: { rejectUnauthorized: false },
  },
  query: { raw: true },
});

//---------------------------------------------------------------------------
// Define Models
//---------------------------------------------------------------------------
const Category = sequelize.define("Category", {
  categoryID: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  },
  categoryName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

const Item = sequelize.define("item", {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  postDate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
  price: Sequelize.FLOAT,
  categoryID: {
    type: Sequelize.INTEGER,
    references: {
      model: Category,
      key: "categoryID",
    },
  },
});

Item.belongsTo(Category, { foreignKey: "categoryID" });
Category.hasMany(Item, { foreignKey: "categoryID" });

//---------------------------------------------------------------------------
/// initialize
//---------------------------------------------------------------------------
const initialize = () => {
  return new Promise((resolve, reject) => {
    sequelize
      .sync()
      .then(() => {
        resolve();
      })
      .catch((err) => {
        reject("unable to sync the database. " + err);
      });
  });
};

//---------------------------------------------------------------------------
/// Category Functions
//---------------------------------------------------------------------------
const getCategories = () => {
  return new Promise((resolve, reject) => {
    Category.findAll()
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned" + err));
  });
};

const addCategory = (categoryData) => {
  return new Promise((resolve, reject) => {
    console.log("Category Data:", categoryData);
    for (let key in categoryData) {
      if (categoryData[key] === "") {
        categoryData[key] = null;
      }
    }
    Category.create(categoryData)
      .then(() => resolve())
      .catch((err) => {
        console.error("Error:", err);
        reject("Unable to create category: " + err.message || err);
      });
  });
};

const deleteCategoryById = (id) => {
  return new Promise((resolve, reject) => {
    Category.destroy({
      where: { categoryID: id },
    })
      .then((deleted) => {
        if (deleted) resolve();
        else reject("Category not found");
      })
      .catch((err) => reject("Unable to delete category: " + err));
  });
};

const getPublishedItemsByCategory = (category) => {
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        categoryID: category,
        published: true,
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned", err));
  });
};

//---------------------------------------------------------------------------
/// Item Functions
//---------------------------------------------------------------------------
const getAllItems = () => {
  return new Promise((resolve, reject) => {
    Item.findAll()
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned", err));
  });
};

const getPublishedItems = () => {
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        published: true,
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned", err));
  });
};

const addItem = (itemData) => {
  itemData.published = !!itemData.published;
  itemData.postDate = new Date();
  itemData.categoryID = parseInt(itemData.categoryID, 10);

  return new Promise((resolve, reject) => {
    Item.create(itemData)
      .then(() => resolve())
      .catch((err) => reject("Unable to create item: " + err));
  });
};

const getItemsByMinDate = (minDateStr) => {
  const { gte } = Sequelize.Op;
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        postDate: {
          [gte]: new Date(minDateStr),
        },
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned", err));
  });
};

const getItemById = (id) => {
  return new Promise((resolve, reject) => {
    Item.findOne({
      where: { id: id },
    })
      .then((item) => {
        if (item) {
          resolve(item);
        } else {
          reject("Item not found");
        }
      })
      .catch((err) => reject("Error fetching item details: " + err));
  });
};

const getItemsByCategory = (category) => {
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        categoryID: category,
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("No results returned: " + err));
  });
};

const getCategoryById = (id) => {
  return new Promise((resolve, reject) => {
    Category.findByPk(id)
      .then((category) => {
        if (category) {
          resolve(category);
        } else {
          resolve(null);
        }
      })
      .catch((err) => reject("Error fetching category details: " + err));
  });
};

const deleteItemById = (id) => {
  return new Promise((resolve, reject) => {
    Item.destroy({
      where: { id: id },
    })
      .then((deleted) => {
        if (deleted) resolve();
        else reject("Item not found");
      })
      .catch((err) => reject("Unable to delete item: " + err));
  });
};

const deletePostById = (id) => {
  return new Promise((resolve, reject) => {
    Post.destroy({ where: { id } })
      .then((rowsDeleted) => {
        if (rowsDeleted === 1) {
          resolve();
        } else {
          reject("Post not found");
        }
      })
      .catch((err) => reject(err));
  });
};

module.exports = {
  initialize,
  getAllItems,
  getPublishedItems,
  getCategories,
  addCategory,
  deleteCategoryById,
  getPublishedItemsByCategory,
  addItem,
  getItemsByCategory,
  getItemsByMinDate,
  getItemById,
  deleteItemById,
  deletePostById,
  getCategoryById,
};
