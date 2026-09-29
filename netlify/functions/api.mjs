import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const store = getStore("codm-attachments");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

const initialAttachments = [
  { id: "a1", weapon: "Kilo 141", attachment: "Monolithic Suppressor", type: "Muzzle", description: "Suppresses shots and improves range.", image: "", featured: true },
  { id: "a2", weapon: "Kilo 141", attachment: "OWC Marksman", type: "Barrel", description: "Improves range and bullet velocity.", image: "", featured: true },
  { id: "a3", weapon: "Kilo 141", attachment: "No Stock", type: "Stock", description: "Improves mobility at the cost of control.", image: "", featured: false },
  { id: "a4", weapon: "DR-H", attachment: "Monolithic Suppressor", type: "Muzzle", description: "A stealth-focused muzzle option.", image: "", featured: false },
  { id: "a5", weapon: "DR-H", attachment: "OWC Ranger", type: "Barrel", description: "Improves effective range and control.", image: "", featured: false },
  { id: "a6", weapon: "QQ9", attachment: "Monolithic Suppressor", type: "Muzzle", description: "Keeps shots quiet while preserving range.", image: "", featured: false },
  { id: "a7", weapon: "QQ9", attachment: "MIP Tactical Barrel", type: "Barrel", description: "Adds range and recoil benefits.", image: "", featured: false },
  { id: "a8", weapon: "DL Q33", attachment: "OWC Light Suppressor", type: "Muzzle", description: "Lightweight suppressor option.", image: "", featured: false }
];

const initialCallouts = [
  { id: "c1", title: "Nuketown — Yellow House", description: "A common close-range fight area. Watch the windows and side lanes.", image: "", featured: true },
  { id: "c2", title: "Crash — Three-Story", description: "High-ground sightline with multiple entry routes.", image: "", featured: true },
  { id: "c3", title: "Firing Range — Tower", description: "Long sightlines make this a useful sniper callout.", image: "", featured: true }
];

async function readCollection(key, fallback) {
  const value = await store.get(key, { type: "json" });
  if (value === null) {
    await store.setJSON(key, fallback);
    return fallback;
  }
  return value;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function makeToken() {
  const payload = `admin.${Date.now() + 1000 * 60 * 60 * 24 * 7}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function isAdmin(req) {
  if (!SESSION_SECRET || !ADMIN_PASSWORD) return false;
  const raw = req.headers.get("cookie") || "";
  const match = raw.match(/codm_admin=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return false;
  return Number(parts[1]) > Date.now();
}

function requireAdmin(req) {
  return isAdmin(req) ? null : json({ error: "Admin login required." }, 401);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = req.method;

  try {
    if (method === "GET" && path === "attachments") {
      const data = await readCollection("attachments", initialAttachments);
      const q = (url.searchParams.get("q") || "").toLowerCase().trim();

      const filtered = q
        ? data.filter(a => [a.weapon, a.attachment, a.type, a.description].some(v => String(v || "").toLowerCase().includes(q)))
        : data;

      return json(filtered.sort((a, b) => Number(b.featured) - Number(a.featured) || a.weapon.localeCompare(b.weapon)));
    }

    if (method === "GET" && path === "callouts") {
      const data = await readCollection("callouts", initialCallouts);
      return json(data.filter(c => c.featured));
    }

    if (method === "GET" && path === "admin/me") {
      return json({ admin: isAdmin(req) });
    }

    if (method === "POST" && path === "admin/login") {
      const body = await req.json();
      if (!ADMIN_PASSWORD || !SESSION_SECRET) {
        return json({ error: "ADMIN_PASSWORD and SESSION_SECRET must be configured in Netlify." }, 500);
      }
      if (body.password !== ADMIN_PASSWORD) return json({ error: "Invalid admin password." }, 401);

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": `codm_admin=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
        }
      });
    }

    if (method === "POST" && path === "admin/logout") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "codm_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        }
      });
    }

    const authError = requireAdmin(req);
    if (authError) return authError;

    if (method === "POST" && path === "attachments") {
      const body = await req.json();
      if (!body.weapon || !body.attachment || !body.type) {
        return json({ error: "Weapon, attachment and type are required." }, 400);
      }

      const data = await readCollection("attachments", initialAttachments);
      const item = {
        id: id("a"),
        weapon: String(body.weapon).trim(),
        attachment: String(body.attachment).trim(),
        type: String(body.type).trim(),
        description: String(body.description || "").trim(),
        image: String(body.image || "").trim(),
        featured: Boolean(body.featured)
      };
      data.push(item);
      await store.setJSON("attachments", data);
      return json(item, 201);
    }

    if (method === "DELETE" && path.startsWith("attachments/")) {
      const itemId = path.split("/")[1];
      const data = await readCollection("attachments", initialAttachments);
      const next = data.filter(x => x.id !== itemId);
      if (next.length === data.length) return json({ error: "Attachment not found." }, 404);
      await store.setJSON("attachments", next);
      return json({ ok: true });
    }

    if (method === "POST" && path === "callouts") {
      const body = await req.json();
      if (!body.title) return json({ error: "Callout title is required." }, 400);

      const data = await readCollection("callouts", initialCallouts);
      const item = {
        id: id("c"),
        title: String(body.title).trim(),
        description: String(body.description || "").trim(),
        image: String(body.image || "").trim(),
        featured: body.featured !== false
      };
      data.push(item);
      await store.setJSON("callouts", data);
      return json(item, 201);
    }

    if (method === "DELETE" && path.startsWith("callouts/")) {
      const itemId = path.split("/")[1];
      const data = await readCollection("callouts", initialCallouts);
      const next = data.filter(x => x.id !== itemId);
      if (next.length === data.length) return json({ error: "Callout not found." }, 404);
      await store.setJSON("callouts", next);
      return json({ ok: true });
    }

    return json({ error: "API route not found." }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: "Server error. Check Netlify Function logs." }, 500);
  }
};
