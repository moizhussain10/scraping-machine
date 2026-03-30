import express from 'express';
import cors from 'cors';
import { startHunting } from './hunter.js';

const app = express();
app.use(cors());
app.use(express.json());

// 1. Leads ko store karne ke liye global array
let scrapedLeads = [];

// 2. Hunter ko batane ke liye function ke data kahan phenkna hai
global.addLead = (newLead) => {
    // Duplicate check taake array bhar na jaye
    const exists = scrapedLeads.some(l => l.serial === newLead.serial && l.owner === newLead.owner);
    if (!exists) {
        scrapedLeads.push(newLead);
        console.log(`📍 Lead added to store: ${newLead.owner}`);
    }
};

// 3. API Endpoint: Frontend yahan se data har 3 second baad lega
app.get('/api/leads', (req, res) => {
    res.json(scrapedLeads);
});

// 4. Search start karne ka endpoint
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query missing!" });

    // Purani leads saaf kar do naye search ke liye (Optional)
    scrapedLeads = []; 

    res.json({ message: "Hunting started!" });

    startHunting(query).catch(err => console.error("Hunter Error:", err));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));