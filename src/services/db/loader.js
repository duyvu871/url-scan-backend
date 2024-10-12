const loadMongo = async () => {
    const mongoose = require('mongoose');

    try {
        await mongoose.connect(
            `${process.env.MONGODB_URI}/${process.env.MONGODB_DB_NAME}${process.env?.MONGODB_DB_OPTIONS ? `?${process.env.MONGODB_DB_OPTIONS}` : ""}`
        ).then(() => {
            console.log('MongoDB connected');
        }).catch((err) => {
            console.log('MongoDB connection error', err);
        });
    } catch (err) {
        console.log('MongoDB connection error', err);
    }
}

module.exports = {
    loadMongo
}