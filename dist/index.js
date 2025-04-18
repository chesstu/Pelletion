// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import crypto from "crypto";
var MemStorage = class {
  users;
  battleRequests;
  userIdCounter;
  battleRequestIdCounter;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.battleRequests = /* @__PURE__ */ new Map();
    this.userIdCounter = 1;
    this.battleRequestIdCounter = 1;
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.userIdCounter++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  // Battle request methods
  async createBattleRequest(request) {
    const id = this.battleRequestIdCounter++;
    const token = crypto.randomBytes(32).toString("hex");
    const status = "pending";
    const createdAt = /* @__PURE__ */ new Date();
    let requestedDate;
    if (typeof request.requestedDate === "string") {
      requestedDate = new Date(request.requestedDate);
    } else {
      requestedDate = request.requestedDate;
    }
    const notes = request.notes === void 0 ? null : request.notes;
    const battleRequest = {
      id,
      name: request.name,
      email: request.email,
      twitchUsername: request.twitchUsername,
      game: request.game,
      notes,
      requestedDate,
      requestedTime: request.requestedTime,
      status,
      token,
      createdAt
    };
    this.battleRequests.set(id, battleRequest);
    return battleRequest;
  }
  async getBattleRequest(id) {
    return this.battleRequests.get(id);
  }
  async getBattleRequestByToken(token) {
    return Array.from(this.battleRequests.values()).find(
      (request) => request.token === token
    );
  }
  async getBattleRequests() {
    return Array.from(this.battleRequests.values()).sort((a, b) => {
      const dateA = new Date(a.requestedDate).getTime();
      const dateB = new Date(b.requestedDate).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return a.requestedTime.localeCompare(b.requestedTime);
    });
  }
  async updateBattleRequestStatus(token, status) {
    const request = await this.getBattleRequestByToken(token);
    if (!request) {
      return void 0;
    }
    const updatedRequest = {
      ...request,
      status
    };
    this.battleRequests.set(request.id, updatedRequest);
    return updatedRequest;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var battleRequests = pgTable("battleRequests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  twitchUsername: text("twitchUsername").notNull(),
  game: text("game").notNull(),
  notes: text("notes"),
  requestedDate: timestamp("requestedDate").notNull(),
  requestedTime: text("requestedTime").notNull(),
  status: text("status").default("pending").notNull(),
  // pending, confirmed, rejected
  token: text("token").notNull(),
  // token for accepting/rejecting
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var baseInsertSchema = createInsertSchema(battleRequests).omit({
  id: true,
  status: true,
  token: true,
  createdAt: true
});
var insertBattleRequestSchema = baseInsertSchema.extend({
  requestedDate: z.string().or(z.date())
});
var updateBattleRequestStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected"]),
  token: z.string()
});
var twitchChannelInfo = z.object({
  id: z.string(),
  login: z.string(),
  display_name: z.string(),
  type: z.string(),
  broadcaster_type: z.string(),
  description: z.string(),
  profile_image_url: z.string(),
  offline_image_url: z.string(),
  view_count: z.number(),
  is_live: z.boolean().optional()
});
var twitchStreamInfo = z.object({
  id: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  game_id: z.string(),
  game_name: z.string(),
  type: z.string(),
  title: z.string(),
  viewer_count: z.number(),
  started_at: z.string(),
  language: z.string(),
  thumbnail_url: z.string(),
  tag_ids: z.array(z.string()).optional(),
  is_mature: z.boolean().optional()
});
var twitchVideoInfo = z.object({
  id: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  published_at: z.string(),
  url: z.string(),
  thumbnail_url: z.string(),
  viewable: z.string(),
  view_count: z.number(),
  language: z.string(),
  type: z.string(),
  duration: z.string()
});

// server/routes.ts
import { ZodError } from "zod";

// server/services/emailService.ts
import { Resend } from "resend";
import { format } from "date-fns";
var resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.warn("RESEND_API_KEY is not set. Email functionality will not work properly.");
}
var resend = new Resend(resendApiKey);
function formatDate(date) {
  if (typeof date === "string") {
    date = new Date(date);
  }
  return format(date, "MMMM d, yyyy");
}
async function sendBattleRequestEmail(request) {
  const { name, email, twitchUsername, game, requestedDate, requestedTime, notes, token } = request;
  const formattedDate = formatDate(requestedDate);
  const replitDomain = process.env.REPLIT_DOMAINS;
  const baseUrl = replitDomain ? `https://${replitDomain}` : "http://localhost:5000";
  const acceptUrl = `${baseUrl}/admin?token=${token}&action=accept`;
  const rejectUrl = `${baseUrl}/admin?token=${token}&action=reject`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0E0E10; color: #EFEFF1; border-radius: 8px;">
      <div style="background-color: #9146FF; padding: 15px; border-radius: 4px 4px 0 0; text-align: center;">
        <h2 style="margin: 0; color: white;">New Battle Request</h2>
      </div>
      
      <div style="padding: 20px; background-color: #18181B; border-radius: 0 0 4px 4px;">
        <p>You have received a new battle request from <strong>${name}</strong>.</p>
        
        <div style="background-color: #0E0E10; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #9146FF;">Battle Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Twitch Username:</strong> ${twitchUsername}</p>
          <p><strong>Game:</strong> ${game}</p>
          <p><strong>Requested Date:</strong> ${formattedDate}</p>
          <p><strong>Requested Time:</strong> ${requestedTime}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${acceptUrl}" style="display: inline-block; background-color: #00FF7F; color: #0E0E10; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Request</a>
          <a href="${rejectUrl}" style="display: inline-block; background-color: #FF4D4D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Decline Request</a>
        </div>
        
        <p style="margin-top: 20px; font-size: 12px; color: #808080;">This email was sent automatically from your Twitch Battle Request system.</p>
      </div>
    </div>
  `;
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error("ADMIN_EMAIL environment variable is not set. Notification email will not be sent.");
      return;
    }
    const { data, error } = await resend.emails.send({
      from: "Twitch Battle Requests <onboarding@resend.dev>",
      to: [adminEmail],
      subject: `New Battle Request from ${name}`,
      html
    });
    if (error) {
      throw error;
    }
    console.log(`Battle request notification sent to admin for ${name}'s request`, data);
  } catch (error) {
    console.error("Error sending battle request email:", error);
    throw error;
  }
}
async function sendConfirmationEmail(request) {
  const { name, email, twitchUsername, game, requestedDate, requestedTime } = request;
  const formattedDate = formatDate(requestedDate);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0E0E10; color: #EFEFF1; border-radius: 8px;">
      <div style="background-color: #9146FF; padding: 15px; border-radius: 4px 4px 0 0; text-align: center;">
        <h2 style="margin: 0; color: white;">Battle Request Confirmed!</h2>
      </div>
      
      <div style="padding: 20px; background-color: #18181B; border-radius: 0 0 4px 4px;">
        <p>Hello ${name},</p>
        <p>Great news! Your battle request has been <strong style="color: #00FF7F;">confirmed</strong>. Get ready to play!</p>
        
        <div style="background-color: #0E0E10; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #9146FF;">Battle Details</h3>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${requestedTime}</p>
          <p><strong>Game:</strong> ${game}</p>
          <p><strong>Twitch Channel:</strong> <a href="https://www.twitch.tv/pelletion" style="color: #9146FF;">twitch.tv/pelletion</a></p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #0E0E10; border-radius: 4px; border-left: 4px solid #00FF7F;">
          <p style="margin: 0;"><strong>Important:</strong> Please be online at least 5 minutes before the scheduled time. Make sure to follow the channel so you'll know when the stream starts!</p>
        </div>
        
        <p style="margin-top: 20px;">If you have any questions or need to reschedule, please reply to this email.</p>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://www.twitch.tv/pelletion" style="display: inline-block; background-color: #9146FF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Visit Twitch Channel</a>
        </div>
        
        <p style="margin-top: 30px;">See you soon!</p>
        <p style="margin-bottom: 0;">- Pelletion</p>
      </div>
    </div>
  `;
  try {
    const testMode = process.env.NODE_ENV !== "production";
    const emailRecipient = testMode ? "delivered@resend.dev" : email;
    const { data, error } = await resend.emails.send({
      from: "Pelletion - Twitch <onboarding@resend.dev>",
      to: [emailRecipient],
      subject: "Your Battle Request has been Confirmed!",
      html
    });
    if (error) {
      throw error;
    }
    console.log(`Confirmation email sent to ${email}`, data);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    throw error;
  }
}
async function sendRejectionEmail(request) {
  const { name, email, requestedDate, requestedTime } = request;
  const formattedDate = formatDate(requestedDate);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0E0E10; color: #EFEFF1; border-radius: 8px;">
      <div style="background-color: #9146FF; padding: 15px; border-radius: 4px 4px 0 0; text-align: center;">
        <h2 style="margin: 0; color: white;">Battle Request Update</h2>
      </div>
      
      <div style="padding: 20px; background-color: #18181B; border-radius: 0 0 4px 4px;">
        <p>Hello ${name},</p>
        <p>Thank you for your interest in battling with me. Unfortunately, I'm unable to accept your request for <strong>${formattedDate}</strong> at <strong>${requestedTime}</strong>.</p>
        
        <p>This could be due to scheduling conflicts or other commitments that have come up.</p>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #0E0E10; border-radius: 4px;">
          <p style="margin: 0;">Feel free to submit a new request for a different date and time. I'd love to play with you when our schedules align!</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://www.twitch.tv/pelletion" style="display: inline-block; background-color: #9146FF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Follow on Twitch</a>
        </div>
        
        <p style="margin-top: 30px;">Thanks for your understanding!</p>
        <p style="margin-bottom: 0;">- Pelletion</p>
      </div>
    </div>
  `;
  try {
    const testMode = process.env.NODE_ENV !== "production";
    const emailRecipient = testMode ? "delivered@resend.dev" : email;
    const { data, error } = await resend.emails.send({
      from: "Pelletion - Twitch <onboarding@resend.dev>",
      to: [emailRecipient],
      subject: "About Your Battle Request",
      html
    });
    if (error) {
      throw error;
    }
    console.log(`Rejection email sent to ${email}`, data);
  } catch (error) {
    console.error("Error sending rejection email:", error);
    throw error;
  }
}

// server/routes.ts
import axios from "axios";
var TWITCH_API_BASE = "https://api.twitch.tv/helix";
var TWITCH_CHANNEL_NAME = "pelletion";
async function registerRoutes(app2) {
  app2.get("/api/twitch/auth", async (req, res) => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Twitch API credentials not configured" });
      }
      const result = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
      return res.json({
        accessToken: result.data.access_token,
        expiresIn: result.data.expires_in
      });
    } catch (error) {
      console.error("Error getting Twitch auth token:", error);
      return res.status(500).json({ error: "Failed to authenticate with Twitch" });
    }
  });
  app2.get("/api/twitch/client-token", async (req, res) => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Twitch API credentials not configured" });
      }
      const result = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
      return res.json({
        clientId,
        accessToken: result.data.access_token,
        expiresIn: result.data.expires_in
      });
    } catch (error) {
      console.error("Error getting Twitch client token:", error);
      return res.status(500).json({ error: "Failed to get client token" });
    }
  });
  app2.get("/api/twitch/channel/live", async (req, res) => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const accessToken = req.headers.authorization?.split(" ")[1];
      if (!clientId || !accessToken) {
        return res.status(400).json({ error: "Missing Twitch credentials" });
      }
      const userResponse = await axios.get(`${TWITCH_API_BASE}/users?login=${TWITCH_CHANNEL_NAME}`, {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      if (!userResponse.data.data.length) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const userId = userResponse.data.data[0].id;
      const streamResponse = await axios.get(`${TWITCH_API_BASE}/streams?user_id=${userId}`, {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      const isLive = streamResponse.data.data.length > 0;
      if (isLive) {
        return res.json({
          isLive: true,
          streamData: streamResponse.data.data[0]
        });
      } else {
        return res.json({
          isLive: false
        });
      }
    } catch (error) {
      console.error("Error checking live status:", error);
      return res.status(500).json({ error: "Failed to check live status" });
    }
  });
  app2.get("/api/twitch/channel/videos", async (req, res) => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const accessToken = req.headers.authorization?.split(" ")[1];
      console.log("Videos API called with token:", accessToken ? accessToken.substring(0, 10) + "..." : "none");
      if (!clientId || !accessToken) {
        console.log("Missing credentials - Client ID:", !!clientId, "Access Token:", !!accessToken);
        return res.status(400).json({ error: "Missing Twitch credentials" });
      }
      console.log(`Getting user info for channel: ${TWITCH_CHANNEL_NAME}`);
      const userResponse = await axios.get(`${TWITCH_API_BASE}/users?login=${TWITCH_CHANNEL_NAME}`, {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      console.log("User response data:", JSON.stringify(userResponse.data));
      if (!userResponse.data.data.length) {
        console.log("Channel not found");
        return res.status(404).json({ error: "Channel not found" });
      }
      const userId = userResponse.data.data[0].id;
      console.log(`Got user ID: ${userId}, fetching clips`);
      const clipsResponse = await axios.get(`${TWITCH_API_BASE}/clips?broadcaster_id=${userId}&first=6`, {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      console.log(`Received ${clipsResponse.data.data.length} clips from Twitch API`);
      const transformedData = clipsResponse.data.data.map((clip) => ({
        id: clip.id,
        title: clip.title,
        url: clip.url,
        thumbnail_url: clip.thumbnail_url,
        view_count: clip.view_count,
        duration: "00:30",
        // Clips are typically short
        created_at: clip.created_at,
        published_at: clip.created_at
      }));
      const response = { data: transformedData };
      console.log("Sending response with clips:", JSON.stringify(response));
      return res.json(response);
    } catch (error) {
      console.error("Error fetching channel clips:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      return res.status(500).json({ error: "Failed to fetch channel clips" });
    }
  });
  app2.post("/api/battle-requests", async (req, res) => {
    try {
      console.log("Received battle request data:", JSON.stringify(req.body));
      const data = insertBattleRequestSchema.parse(req.body);
      console.log("Parsed battle request data:", JSON.stringify(data));
      const request = await storage.createBattleRequest(data);
      res.status(201).json(request);
      try {
        await sendBattleRequestEmail(request);
        console.log("Battle request email sent successfully to admin");
      } catch (err) {
        console.error("Failed to send battle request email:", err);
      }
      return;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors));
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating battle request:", error);
      return res.status(500).json({ error: "Failed to create battle request" });
    }
  });
  app2.get("/api/battle-requests", async (req, res) => {
    try {
      const requests = await storage.getBattleRequests();
      return res.json(requests);
    } catch (error) {
      console.error("Error fetching battle requests:", error);
      return res.status(500).json({ error: "Failed to fetch battle requests" });
    }
  });
  app2.get("/api/battle-requests/availability", async (req, res) => {
    try {
      const dateStr = req.query.date;
      if (!dateStr) {
        return res.status(400).json({ error: "Date parameter is required" });
      }
      const date = new Date(dateStr);
      const allRequests = await storage.getBattleRequests();
      const allTimeSlots = [
        "2:00 PM",
        "3:00 PM",
        "4:00 PM",
        "5:00 PM",
        "6:00 PM",
        "7:00 PM",
        "8:00 PM",
        "9:00 PM",
        "10:00 PM",
        "11:00 PM"
      ];
      const formattedDate = date.toISOString().split("T")[0];
      const result = allTimeSlots.map((time) => {
        const isTaken = allRequests.some((request) => {
          const requestDate = new Date(request.requestedDate).toISOString().split("T")[0];
          return requestDate === formattedDate && request.requestedTime === time && (request.status === "confirmed" || request.status === "pending");
        });
        return {
          time,
          available: !isTaken
        };
      });
      return res.json(result);
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      return res.status(500).json({ error: "Failed to check time slot availability" });
    }
  });
  app2.post("/api/battle-requests/update-status", async (req, res) => {
    try {
      console.log("Received status update data:", JSON.stringify(req.body));
      const { status, token } = updateBattleRequestStatusSchema.parse(req.body);
      const request = await storage.updateBattleRequestStatus(token, status);
      if (!request) {
        return res.status(404).json({ error: "Battle request not found" });
      }
      res.json(request);
      if (status === "confirmed") {
        try {
          await sendConfirmationEmail(request);
          console.log(`Confirmation email sent successfully to ${request.email}`);
        } catch (err) {
          console.error("Failed to send confirmation email:", err);
        }
      } else if (status === "rejected") {
        try {
          await sendRejectionEmail(request);
          console.log(`Rejection email sent successfully to ${request.email}`);
        } catch (err) {
          console.error("Failed to send rejection email:", err);
        }
      }
      return;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors));
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating battle request status:", error);
      return res.status(500).json({ error: "Failed to update battle request status" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
