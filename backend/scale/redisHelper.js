import {redis} from "./redis.js";

const setCache = async (key, value, ttl = 3600) => {
    try {
        await redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch (error) {
        console.error("Error setting cache:", error);
    }
};

const getCache = async (key) => {
    try {
        const data = await redis.get(key);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error getting cache:", error);
    }
};

export { setCache, getCache };