const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
    userName: { type: String, unique: true },
    password: String,
    email: String,
    loginHistory: [{
        dateTime: Date,
        userAgent: String
    }]
});

let User;

module.exports.initialize = function () {
    return new Promise((resolve, reject) => {
        let db = mongoose.createConnection("mongodb+srv://admin:admin@krishxps.yox3f71.mongodb.net/?retryWrites=true&w=majority&appName=krishxps");

        db.on('error', (err) => {
            reject(err);
        });

        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
};

module.exports.registerUser = async function (userData) {
    if (userData.password !== userData.password2) {
        return Promise.reject("Passwords do not match");
    }
    
    try {
        const hash = await bcrypt.hash(userData.password, 10);
        userData.password = hash;
        const newUser = new User(userData);
        await newUser.save();  // save() now returns a promise
        return Promise.resolve();
    } catch (err) {
        if (err.code === 11000) {
            return Promise.reject("User Name already taken");
        }
        return Promise.reject("There was an error creating the user: " + err);
    }
};

module.exports.checkUser = async function (userData) {
    try {
        const users = await User.find({ userName: userData.userName }).exec();
        if (users.length === 0) {
            return Promise.reject("Unable to find user: " + userData.userName);
        }
        
        const result = await bcrypt.compare(userData.password, users[0].password);
        if (!result) {
            return Promise.reject("Incorrect Password for user: " + userData.userName);
        }
        
        users[0].loginHistory.push({
            dateTime: (new Date()).toString(),
            userAgent: userData.userAgent
        });

        await User.updateOne(
            { userName: users[0].userName },
            { $set: { loginHistory: users[0].loginHistory } }
        ).exec();

        return Promise.resolve(users[0]);
    } catch (err) {
        return Promise.reject("There was an error verifying the user: " + err);
    }
};
