const express = require("express");
const crypto = require("crypto");
const https = require("https");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const SEARCH_URL = "https://www.plurk.com/APP/PlurkSearch/search";
const REPLURK_URL = "https://www.plurk.com/APP/Timeline/replurk";

const OAUTH_TOKEN = process.env.OAUTH_TOKEN;
const OAUTH_TOKEN_SECRET = process.env.OAUTH_TOKEN_SECRET;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

// Function to generate OAuth 1.0a signature
const generateOAuthSignature = (method, url, params) => {
    const encode = (str) => encodeURIComponent(str).replace(/[!'()*]/g, escape);

    const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${encode(key)}=${encode(params[key])}`)
        .join("&");

    const baseString = `${method.toUpperCase()}&${encode(url)}&${encode(sortedParams)}`;
    const signingKey = `${encode(CONSUMER_SECRET)}&${encode(OAUTH_TOKEN_SECRET)}`;

    return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
};

// Function to make HTTP GET requests with `https` module
const makeGetRequest = (url, headers) => {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (response) => {
            let data = "";
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject("Error parsing response data");
                }
            });
        }).on("error", (error) => {
            reject(`Request error: ${error.message}`);
        });
    });
};

// Function to search for specific hashtags
const searchPlurks = async (query) => {
    console.log("🔍 Searching for Plurks...");
    const oauthParams = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_token: OAUTH_TOKEN,
        oauth_nonce: Math.random().toString(36).substring(2),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000),
        oauth_version: "1.0",
        query,
        offset: 0,
    };

    oauthParams.oauth_signature = generateOAuthSignature("GET", SEARCH_URL, oauthParams);

    const authHeader =
        "OAuth " +
        Object.keys(oauthParams)
            .map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`)
            .join(", ");

    const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&offset=0`;
    const headers = { Authorization: authHeader };

    try {
        const data = await makeGetRequest(url, headers);
        if (!data.plurks || data.plurks.length === 0) {
            console.log("❌ No new Plurks found.");
            return [];
        }

        const plurkIds = data.plurks.map((plurk) => plurk.plurk_id);
        console.log(`✅ Found ${plurkIds.length} Plurks:`, plurkIds);
        return plurkIds;
    } catch (error) {
        console.error("❌ Error fetching Plurks:", error);
        return [];
    }
};

// Function to replurk posts
const replurk = async (plurkIds) => {
    if (plurkIds.length === 0) return;

    console.log("🔁 Replurking Plurks...");
    const idsParam = JSON.stringify(plurkIds);

    const oauthParams = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_token: OAUTH_TOKEN,
        oauth_nonce: Math.random().toString(36).substring(2),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000),
        oauth_version: "1.0",
        ids: idsParam,
    };

    oauthParams.oauth_signature = generateOAuthSignature("GET", REPLURK_URL, oauthParams);

    const queryString = new URLSearchParams(oauthParams).toString();
    const urlWithParams = `${REPLURK_URL}?${queryString}`;
    const headers = { Authorization: `OAuth ${Object.keys(oauthParams).map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`).join(", ")}` };

    try {
        const data = await makeGetRequest(urlWithParams, headers);
        console.log("✅ Replurk Response:", data);
    } catch (error) {
        console.error("❌ Error replurking:", error);
    }
};

// API endpoint to trigger replurk
app.get("/run-cron", async (req, res) => {
    console.log("🛠 Triggering Plurk Auto-Replurk Job...");

    const hashTags = ["#卿卿我我", "#卿卿我我 #角色推薦"];

    hashTags.forEach(async (tag) => {
        const plurkIds = await searchPlurks(tag);
        console.log("plurkIds", plurkIds);
        await replurk(plurkIds);

        
    });

    res.status(200).send(`Replurked posts that contain ${hashTags.join(', ')} completed!`);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});