import express from 'express';
import cors from 'cors';
import { createServer } from 'http'; // Socket ke liye zaroori hai
import { Server } from 'socket.io';
import { startHunting } from './hunter.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Global socket instance taake hunter.js isay use kar sake
global.io = io;

app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query missing!" });

  res.json({ message: "Hunting started!" });

  // Hunter ko io instance pass kar rahe hain
  startHunting(query, io).catch(err => console.error("Hunter Error:", err));
});

const PORT = 5000;
httpServer.listen(PORT, () => console.log(`✅ Server & Sockets running on port ${PORT}`));