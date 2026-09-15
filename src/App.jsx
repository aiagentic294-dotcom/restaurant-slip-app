import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  ChevronLeft,
  Printer,
  Check,
  Loader2,
  UtensilsCrossed,
  Flame,
  Beef,
  GlassWater,
  Sandwich,
  Soup,
  Pencil,
  RotateCcw,
  Bluetooth,
  Settings,
} from "lucide-react";
import chickenBiryaniImg from "./assets/food/chicken-biryani.jpg";

/* ----------------------------------------------------------------------- */
/*  DESIGN TOKENS                                                          */
/* ----------------------------------------------------------------------- */

const tokens = {
  color: {
    primary: "#221E1B",       // deep warm charcoal
    primarySoft: "#3A342F",
    accent: "#E1611F",        // warm restaurant orange
    accentSoft: "#FBE6D8",    // tint of accent, used for badges/highlights
    bg: "#FAF5EF",            // soft warm off-white
    card: "#FFFFFF",
    text: "#2A241F",
    textSecondary: "#948A80",
    border: "#EDE3D8",
    success: "#2E9E5B",
    successSoft: "#E3F4EA",
    error: "#D9534F",
    errorSoft: "#FBE7E6",
    shadow: "rgba(40, 28, 15, 0.10)",
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    pill: 999,
  },
  font: {
    family:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
  },
};

const CATEGORIES = ["All", "Biryani", "Karahi", "BBQ", "Drinks", "Fast Food"];

const CATEGORY_ICON = {
  Biryani: Soup,
  Karahi: Flame,
  BBQ: Beef,
  Drinks: GlassWater,
  "Fast Food": Sandwich,
};

const MENU_ITEMS = [
  { id: "bir-1", name: "Chicken Biryani", price: 300, category: "Biryani", image: chickenBiryaniImg },
  { id: "bir-2", name: "Mutton Biryani", price: 450, category: "Biryani" },
  { id: "bir-3", name: "Vegetable Pulao", price: 220, category: "Biryani" },
  { id: "kar-1", name: "Chicken Karahi", price: 700, category: "Karahi" },
  { id: "kar-2", name: "Beef Karahi", price: 900, category: "Karahi" },
  { id: "kar-3", name: "Mutton Karahi", price: 950, category: "Karahi" },
  { id: "bbq-1", name: "Seekh Kebab", price: 250, category: "BBQ" },
  { id: "bbq-2", name: "Chicken Tikka", price: 280, category: "BBQ" },
  { id: "bbq-3", name: "Beef Boti", price: 320, category: "BBQ" },
  { id: "ff-1", name: "Zinger Burger", price: 380, category: "Fast Food" },
  { id: "ff-2", name: "Chicken Roll", price: 220, category: "Fast Food" },
  { id: "ff-3", name: "Loaded Fries", price: 260, category: "Fast Food" },
  { id: "dr-1", name: "Cold Drink", price: 100, category: "Drinks" },
  { id: "dr-2", name: "Fresh Lime", price: 150, category: "Drinks" },
  { id: "dr-3", name: "Mineral Water", price: 60, category: "Drinks" },
];

/* ----------------------------------------------------------------------- */
/*  PRINTER BRIDGE                                                         */
/* ----------------------------------------------------------------------- */
/*
 * Real Bluetooth/ESC-POS I/O only exists once this UI is packaged into the
 * Android app via Capacitor and paired with the native "EscPosPrinter"
 * plugin (see the companion .kt / manifest files). In this browser preview
 * window.Capacitor is undefined, so the bridge reports itself as
 * unsupported rather than fabricating devices or a fake connection.
 */

function getNativeBridge() {
  if (typeof window === "undefined") return null;
  const plugins = window.Capacitor && window.Capacitor.Plugins;
  return plugins && plugins.EscPosPrinter ? plugins.EscPosPrinter : null;
}

// ---- ESC/POS byte builders ------------------------------------------------
const ESC = 0x1b;
const GS = 0x1d;

function escposBytes(parts) {
  const chunks = parts.map((p) =>
    typeof p === "string" ? Array.from(new TextEncoder().encode(p)) : Array.from(p)
  );
  return new Uint8Array(chunks.reduce((a, b) => a.concat(b), []));
}

function buildTestReceipt(restaurantName) {
  return escposBytes([
    [ESC, 0x40],
    [ESC, 0x61, 0x01],
    [ESC, 0x45, 0x01], restaurantName.toUpperCase() + "\n", [ESC, 0x45, 0x00],
    "\nPRINTER TEST\n\n",
    [ESC, 0x61, 0x00],
    "Bluetooth connection OK\nESC/POS printing OK\n\n",
    [ESC, 0x61, 0x01],
    [ESC, 0x45, 0x01], "TEST SUCCESSFUL\n", [ESC, 0x45, 0x00],
    "\n\n\n",
    [GS, 0x56, 0x42, 0x00],
  ]);
}

// Real order-slip receipt — now wired to the Print Slip button below.
function buildOrderReceipt({ restaurantName, orderNumber, items, total }) {
  const width = 42;
  const line = (left, right) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + " ".repeat(gap) + right + "\n";
  };
  let body = "-".repeat(width) + "\n";
  items.forEach((it) => {
    const name = it.name.length > width ? it.name.slice(0, width) : it.name;
    body += name + "\n";
    body += line(`  ${it.qty} x ${it.price}`, String(it.qty * it.price));
  });
  body += "-".repeat(width) + "\n" + line("TOTAL", `Rs. ${total.toLocaleString()}`);
  return escposBytes([
    [ESC, 0x40],
    [ESC, 0x61, 0x01],
    [ESC, 0x45, 0x01], restaurantName.toUpperCase() + "\n", [ESC, 0x45, 0x00],
    `ORDER #${orderNumber}\n`,
    new Date().toLocaleString() + "\n",
    [ESC, 0x61, 0x00],
    body,
    [ESC, 0x61, 0x01],
    [ESC, 0x45, 0x01], "THANK YOU!\n", [ESC, 0x45, 0x00],
    "\n\n\n", // feed before cut
    [GS, 0x56, 0x42, 0x00],
  ]);
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return typeof btoa === "function" ? btoa(binary) : "";
}

// ---- connection state machine ---------------------------------------------
// not_connected | scanning | device_list | connecting | connected | testing | error
function usePrinter() {
  const [status, setStatus] = useState("not_connected");
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState(null);
  const [message, setMessage] = useState("");
  const bridge = getNativeBridge();
  const supported = !!bridge;

  useEffect(() => {
    if (!bridge || !bridge.addListener) return;
    const sub = bridge.addListener("printerDisconnected", () => {
      setStatus("not_connected");
      setDevice(null);
      setMessage("Printer disconnected");
    });
    return () => sub && sub.remove && sub.remove();
  }, [bridge]);

  async function scan() {
    if (!bridge) {
      setStatus("error");
      setMessage(
        "This preview can't reach device Bluetooth — printer connections work once this UI is packaged into the Android app."
      );
      return;
    }
    setStatus("scanning");
    setMessage("");
    try {
      const res = await bridge.listPairedDevices();
      setDevices(res.devices || []);
      setStatus("device_list");
    } catch (e) {
      setStatus("error");
      setMessage("Could not read paired devices. Please pair the printer in Android Bluetooth settings first.");
    }
  }

  async function connect(d) {
    if (!bridge) return;
    setStatus("connecting");
    setDevice(d);
    setMessage("");
    try {
      await bridge.connect({ address: d.address });
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setMessage("Could not connect to the printer. Please make sure it's switched on and nearby.");
    }
  }

  async function disconnect() {
    if (!bridge) return;
    try {
      await bridge.disconnect();
    } catch (e) {
      /* device may already be gone */
    }
    setStatus("not_connected");
    setDevice(null);
    setMessage("");
  }

  async function testPrint(restaurantName) {
    if (!bridge || status !== "connected") return;
    setStatus("testing");
    try {
      await bridge.write({ dataBase64: bytesToBase64(buildTestReceipt(restaurantName)) });
      setStatus("connected");
      setMessage("Test print sent successfully ✓");
    } catch (e) {
      setStatus("connected");
      setMessage("Test print failed. Check the printer and try again.");
    }
  }

  // Used by the real order-print flow. Does not touch connection status —
  // the caller (App) owns the per-order print-job state, since a failed
  // print isn't necessarily a lost connection.
  async function printBytes(bytes) {
    if (!bridge) throw new Error("No native printer bridge available.");
    if (status !== "connected") throw new Error("Printer not connected.");
    await bridge.write({ dataBase64: bytesToBase64(bytes) });
  }

  return { status, devices, device, message, supported, scan, connect, disconnect, testPrint, printBytes };
}



function PrimaryButton({ children, onClick, disabled, icon: Icon, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-press"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: disabled ? "#D9D2C8" : tokens.color.primary,
        color: "#FFFFFF",
        border: "none",
        borderRadius: tokens.radius.md,
        padding: "16px 20px",
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: disabled ? "default" : "pointer",
        transition: "transform 120ms ease, background 160ms ease",
        ...style,
      }}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        width: "100%",
        background: "transparent",
        color: tokens.color.text,
        border: "none",
        padding: "14px 20px",
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function QuantityControl({ qty, onInc, onDec, size = "md" }) {
  const dim = size === "sm" ? 30 : 34;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: tokens.color.accentSoft,
        borderRadius: tokens.radius.pill,
        padding: 3,
      }}
    >
      <button
        onClick={onDec}
        className="qty-btn"
        aria-label="Decrease quantity"
        style={{
          width: dim,
          height: dim,
          borderRadius: "50%",
          border: "none",
          background: tokens.color.card,
          color: tokens.color.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: `0 1px 2px ${tokens.color.shadow}`,
        }}
      >
        <Minus size={15} strokeWidth={2.6} />
      </button>
      <span
        style={{
          width: 30,
          textAlign: "center",
          fontSize: 15,
          fontWeight: 700,
          color: tokens.color.primary,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {qty}
      </span>
      <button
        onClick={onInc}
        className="qty-btn"
        aria-label="Increase quantity"
        style={{
          width: dim,
          height: dim,
          borderRadius: "50%",
          border: "none",
          background: tokens.color.accent,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: `0 1px 2px ${tokens.color.shadow}`,
        }}
      >
        <Plus size={15} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  MENU SCREEN COMPONENTS                                                 */
/* ----------------------------------------------------------------------- */

function RestaurantHeader({ lastOrder, onReprint, onOpenSettings }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div style={{ padding: "22px 20px 4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 23,
              fontWeight: 800,
              color: tokens.color.primary,
              letterSpacing: -0.3,
            }}
          >
            ABC Restaurant
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: tokens.color.textSecondary,
              fontWeight: 500,
            }}
          >
            {greeting} 👋
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {lastOrder && (
            <button
              onClick={onReprint}
              className="btn-press"
              aria-label="Reprint last slip"
              title="Reprint last slip"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                flexShrink: 0,
                background: "transparent",
                border: "none",
                color: tokens.color.textSecondary,
                cursor: "pointer",
                marginTop: 2,
              }}
            >
              <RotateCcw size={16} strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="btn-press"
            aria-label="Settings"
            title="Settings"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              background: "transparent",
              border: "none",
              color: tokens.color.textSecondary,
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            <Settings size={17} strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: tokens.color.card,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          padding: "12px 14px",
        }}
      >
        <Search size={18} color={tokens.color.textSecondary} strokeWidth={2.2} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search menu..."
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 15,
            width: "100%",
            color: tokens.color.text,
            fontFamily: tokens.font.family,
          }}
        />
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        flexShrink: 0,
        border: active ? "none" : `1px solid ${tokens.color.border}`,
        background: active ? tokens.color.primary : tokens.color.card,
        color: active ? "#FFFFFF" : tokens.color.textSecondary,
        borderRadius: tokens.radius.pill,
        padding: "9px 18px",
        fontSize: 13.5,
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

function FoodImage({ item }) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY_ICON[item.category] || UtensilsCrossed;
  const showImage = !!item.image && !failed;
  return (
    <div
      style={{
        width: "100%",
        height: 78,
        borderRadius: tokens.radius.md,
        background: tokens.color.accentSoft,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <img
          src={item.image}
          alt={item.name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Icon size={28} color={tokens.color.accent} strokeWidth={1.8} />
      )}
    </div>
  );
}

function FoodCard({ item, qty, onAdd, onInc, onDec, bumped }) {
  return (
    <div
      style={{
        background: tokens.color.card,
        borderRadius: tokens.radius.lg,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: `0 2px 10px ${tokens.color.shadow}`,
        border: qty > 0 ? `1.5px solid ${tokens.color.accent}` : "1.5px solid transparent",
        transform: bumped ? "scale(1.03)" : "scale(1)",
        transition: "transform 180ms cubic-bezier(.34,1.56,.64,1), border-color 200ms ease",
      }}
    >
      <FoodImage item={item} />
      <div style={{ minHeight: 52 }}>
        <div
          className="clamp-2"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: tokens.color.text,
            lineHeight: 1.28,
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.color.textSecondary,
            marginTop: 4,
          }}
        >
          Rs. {item.price}
        </div>
      </div>
      <div style={{ marginTop: 2 }} key={qty > 0 ? "qty" : "add"} className="control-pop">
        {qty > 0 ? (
          <QuantityControl qty={qty} onInc={onInc} onDec={onDec} size="sm" />
        ) : (
          <button
            onClick={onAdd}
            className="btn-press"
            style={{
              width: "100%",
              background: tokens.color.primary,
              color: "#FFFFFF",
              border: "none",
              borderRadius: tokens.radius.pill,
              padding: "10px 0",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 38,
            }}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function CartBar({ count, total, onView }) {
  const visible = count > 0;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: visible ? "calc(16px + env(safe-area-inset-bottom, 0px))" : -100,
        transform: "translateX(-50%)",
        width: "min(398px, calc(100vw - 32px))",
        opacity: visible ? 1 : 0,
        transition: "bottom 260ms cubic-bezier(.34,1.56,.64,1), opacity 220ms ease",
        background: tokens.color.primary,
        borderRadius: tokens.radius.lg,
        padding: "14px 14px 14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 10px 24px rgba(34,30,27,0.35)",
        zIndex: 30,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div>
        <div style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>
          {count} {count === 1 ? "Item" : "Items"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, fontWeight: 600 }}>
          Rs. {total.toLocaleString()}
        </div>
      </div>
      <button
        onClick={onView}
        className="btn-press"
        style={{
          background: tokens.color.accent,
          color: "#FFFFFF",
          border: "none",
          borderRadius: tokens.radius.pill,
          padding: "12px 20px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ShoppingBag size={15} strokeWidth={2.4} />
        View Order
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  ORDER SUMMARY SCREEN                                                   */
/* ----------------------------------------------------------------------- */

function ScreenHeader({ title, onBack }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "20px 16px 12px",
      }}
    >
      <button
        onClick={onBack}
        className="btn-press"
        aria-label="Go back"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `1px solid ${tokens.color.border}`,
          background: tokens.color.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <ChevronLeft size={19} color={tokens.color.text} strokeWidth={2.2} />
      </button>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          color: tokens.color.primary,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function OrderItemRow({ item, qty, onInc, onDec, isLast }) {
  return (
    <div
      style={{
        padding: "14px 2px",
        borderBottom: isLast ? "none" : `1px solid ${tokens.color.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: tokens.color.text }}>
          {item.name}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: tokens.color.primary, whiteSpace: "nowrap" }}>
          Rs. {(item.price * qty).toLocaleString()}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: tokens.color.textSecondary }}>
          Rs. {item.price} × {qty}
        </span>
        <QuantityControl qty={qty} onInc={onInc} onDec={onDec} size="sm" />
      </div>
    </div>
  );
}

function OrderSummary({ items, subtotal, total }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ padding: "4px 2px" }}>
        <Row label="Subtotal" value={subtotal} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: tokens.color.primary,
          borderRadius: tokens.radius.md,
          padding: "16px 18px",
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: 0.3 }}>
          Total
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
          Rs. {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 14,
        fontWeight: 600,
        color: tokens.color.textSecondary,
      }}
    >
      <span>{label}</span>
      <span style={{ color: tokens.color.text }}>Rs. {value.toLocaleString()}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  SLIP PREVIEW SCREEN                                                    */
/* ----------------------------------------------------------------------- */

function SlipPreview({ items, total, orderNumber }) {
  return (
    <div
      style={{
        background: "#EDE6DB",
        borderRadius: tokens.radius.lg,
        padding: "28px 0 22px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="receipt-tear"
        style={{
          width: 260,
          background: "#FFFFFF",
          padding: "20px 16px 18px",
          fontFamily: tokens.font.mono,
          color: "#2B2B2B",
          boxShadow: "0 10px 22px rgba(30,22,12,0.18)",
          backgroundImage:
            "linear-gradient(to bottom, transparent 0%, transparent 96%, rgba(0,0,0,0.045) 96%, rgba(0,0,0,0.045) 100%)",
          backgroundSize: "100% 24px",
        }}
      >
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800, letterSpacing: 1.2 }}>
          ABC RESTAURANT
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "#8A8A8A", marginTop: 4 }}>
          {new Date().toLocaleString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, marginTop: 6 }}>
          ORDER #{orderNumber}
        </div>
        <DashLine />
        <div style={{ fontSize: 10.5, display: "flex", padding: "7px 0 5px", fontWeight: 700, color: "#6B6B6B" }}>
          <span style={{ flex: 1 }}>ITEM</span>
          <span style={{ width: 22, textAlign: "center" }}>QTY</span>
          <span style={{ width: 48, textAlign: "right" }}>TOTAL</span>
        </div>
        <DashLine />
        <div style={{ padding: "5px 0" }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{ display: "flex", fontSize: 11.5, padding: "5px 0", alignItems: "flex-start" }}
            >
              <span style={{ flex: 1, paddingRight: 4 }}>{it.name}</span>
              <span style={{ width: 22, textAlign: "center" }}>{it.qty}</span>
              <span style={{ width: 48, textAlign: "right" }}>{it.qty * it.price}</span>
            </div>
          ))}
        </div>
        <DashLine />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13.5,
            fontWeight: 800,
            padding: "9px 0",
          }}
        >
          <span>TOTAL</span>
          <span>Rs. {total.toLocaleString()}</span>
        </div>
        <DashLine />
        <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, marginTop: 14, letterSpacing: 0.5 }}>
          THANK YOU!
        </div>
      </div>
    </div>
  );
}

function DashLine() {
  return (
    <div
      style={{
        borderTop: "1.5px dashed #C9C9C9",
        margin: "2px 0",
      }}
    />
  );
}

function PrinterStatus({ status }) {
  if (status === "idle") return null;
  const config = {
    connecting: {
      icon: Loader2,
      spin: true,
      text: "Connecting to printer...",
      bg: tokens.color.accentSoft,
      color: tokens.color.accent,
    },
    printing: {
      icon: Loader2,
      spin: true,
      text: "Printing slip...",
      bg: tokens.color.accentSoft,
      color: tokens.color.accent,
    },
    success: {
      icon: Check,
      spin: false,
      text: "Slip printed successfully",
      bg: tokens.color.successSoft,
      color: tokens.color.success,
    },
    error: {
      icon: Printer,
      spin: false,
      text: "Printing failed",
      bg: tokens.color.errorSoft,
      color: tokens.color.error,
    },
    not_connected: {
      icon: Printer,
      spin: false,
      text: "Printer not connected",
      bg: tokens.color.errorSoft,
      color: tokens.color.error,
    },
  }[status];
  const Icon = config.icon;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: config.bg,
        color: config.color,
        borderRadius: tokens.radius.md,
        padding: "13px 16px",
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      <Icon size={18} strokeWidth={2.4} className={config.spin ? "spin" : ""} />
      {config.text}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  SETTINGS / PRINTER SCREEN                                              */
/* ----------------------------------------------------------------------- */

function StatusDot({ color }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

function statusLabel(status, device) {
  switch (status) {
    case "connected":
    case "testing":
      return device ? `Connected — ${device.name}` : "Connected ✓";
    case "connecting":
      return "Connecting...";
    case "scanning":
      return "Scanning...";
    case "device_list":
      return "Select a printer";
    case "error":
      return "Connection Failed";
    default:
      return "Not Connected";
  }
}

function PrinterSettingsScreen({ printer, onBack }) {
  const dotColor =
    printer.status === "connected" || printer.status === "testing"
      ? tokens.color.success
      : printer.status === "error"
      ? tokens.color.error
      : tokens.color.textSecondary;

  return (
    <div key="settings" className="page-enter">
      <ScreenHeader title="Settings" onBack={onBack} />
      <div style={{ padding: "4px 16px 24px" }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: tokens.color.textSecondary,
            letterSpacing: 0.4,
            margin: "10px 2px 8px",
          }}
        >
          PRINTER
        </div>
        <div
          style={{
            background: tokens.color.card,
            borderRadius: tokens.radius.lg,
            padding: 18,
            boxShadow: `0 1px 6px ${tokens.color.shadow}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: tokens.color.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bluetooth size={18} color={tokens.color.accent} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: tokens.color.text }}>
                Bluetooth Printer
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <StatusDot color={dotColor} />
                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.color.textSecondary }}>
                  {statusLabel(printer.status, printer.device)}
                </span>
              </div>
            </div>
          </div>

          {!printer.supported && (
            <div
              style={{
                marginTop: 14,
                background: tokens.color.accentSoft,
                borderRadius: tokens.radius.md,
                padding: 12,
                fontSize: 12.5,
                color: tokens.color.primarySoft,
                lineHeight: 1.5,
              }}
            >
              This preview is running in a browser, so it can't reach device Bluetooth.
              Printer connections work once this UI is packaged into the Android app.
            </div>
          )}

          {printer.supported && printer.status === "error" && printer.message && (
            <div
              style={{
                marginTop: 14,
                background: tokens.color.errorSoft,
                color: tokens.color.error,
                borderRadius: tokens.radius.md,
                padding: 12,
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {printer.message}
            </div>
          )}

          {(printer.status === "not_connected" || printer.status === "error") && (
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={printer.scan}>Scan for Printers</PrimaryButton>
            </div>
          )}

          {printer.status === "scanning" && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: tokens.color.textSecondary,
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <Loader2 size={16} className="spin" />
              Scanning for printers...
            </div>
          )}

          {printer.status === "device_list" && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: tokens.color.textSecondary,
                  marginBottom: 8,
                }}
              >
                Available Printers
              </div>
              {printer.devices.length === 0 ? (
                <div style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 1.5 }}>
                  No paired printers found. Pair the printer in Android Bluetooth settings first,
                  then scan again.
                </div>
              ) : (
                printer.devices.map((d) => (
                  <button
                    key={d.address}
                    onClick={() => printer.connect(d)}
                    className="btn-press"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 10px",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.border}`,
                      background: tokens.color.bg,
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    <Bluetooth size={16} color={tokens.color.accent} strokeWidth={2} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: tokens.color.text }}>
                      {d.name || "Unknown device"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {printer.status === "connecting" && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: tokens.color.textSecondary,
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <Loader2 size={16} className="spin" />
              Connecting to {printer.device?.name || "printer"}...
            </div>
          )}

          {(printer.status === "connected" || printer.status === "testing") && (
            <div style={{ marginTop: 16 }}>
              {printer.message && (
                <div
                  style={{
                    marginBottom: 12,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: tokens.color.success,
                  }}
                >
                  {printer.message}
                </div>
              )}
              <PrimaryButton
                onClick={() => printer.testPrint("ABC Restaurant")}
                disabled={printer.status === "testing"}
              >
                {printer.status === "testing" ? "Sending Test Print..." : "Test Print"}
              </PrimaryButton>
              <SecondaryButton onClick={printer.disconnect} style={{ color: tokens.color.error }}>
                Disconnect
              </SecondaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



function EmptyState({ query, onClear }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 20px",
        color: tokens.color.textSecondary,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: tokens.color.accentSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Search size={24} color={tokens.color.accent} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: tokens.color.text }}>
        No items found
      </div>
      <div style={{ fontSize: 13.5, marginTop: 4 }}>
        Try another food name or category.
      </div>
      <button
        onClick={onClear}
        className="btn-press"
        style={{
          marginTop: 16,
          background: "transparent",
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.pill,
          padding: "9px 18px",
          fontSize: 13.5,
          fontWeight: 700,
          color: tokens.color.primarySoft,
          cursor: "pointer",
        }}
      >
        Clear search
      </button>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        padding: "16px 20px 100px",
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            background: tokens.color.card,
            borderRadius: tokens.radius.lg,
            padding: 14,
            boxShadow: `0 2px 10px ${tokens.color.shadow}`,
          }}
        >
          <div
            className="shimmer-block"
            style={{ width: "100%", aspectRatio: "1.5", borderRadius: tokens.radius.md }}
          />
          <div className="shimmer-block" style={{ height: 12, width: "80%", marginTop: 12, borderRadius: 6 }} />
          <div className="shimmer-block" style={{ height: 12, width: "40%", marginTop: 8, borderRadius: 6 }} />
          <div className="shimmer-block" style={{ height: 28, width: "100%", marginTop: 10, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  APP                                                                    */
/* ----------------------------------------------------------------------- */

export default function App() {
  const [screen, setScreen] = useState("menu"); // menu | order | preview | settings
  const [cart, setCart] = useState({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [bumpId, setBumpId] = useState(null);
  const [printStatus, setPrintStatus] = useState("idle");
  const [lastOrder, setLastOrder] = useState(null);
  const [orderNumber, setOrderNumber] = useState(1024);
  const printer = usePrinter();
  const bumpTimer = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filteredItems = useMemo(() => {
    return MENU_ITEMS.filter((it) => {
      const matchesCategory = category === "All" || it.category === category;
      const matchesQuery = it.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  function bump(id) {
    setBumpId(id);
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setBumpId(null), 220);
  }

  function changeQty(id, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[id] || 0) + delta;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
    bump(id);
  }

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const item = MENU_ITEMS.find((m) => m.id === id);
          return item ? { ...item, qty } : null;
        })
        .filter(Boolean),
    [cart]
  );

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0);

  function goToPreview() {
    setOrderNumber((n) => n + 1);
    setScreen("preview");
    setPrintStatus("idle");
  }

  async function handlePrint(itemsToPrint, total, orderNum) {
    if (!printer.supported) {
      // No native bridge in this browser preview — real Bluetooth can't be
      // exercised here. Keep the previous mocked timing so the flow stays
      // demoable; the Android build takes the real branch below instead.
      setPrintStatus("printing");
      setTimeout(() => {
        setPrintStatus("success");
        setLastOrder({ items: itemsToPrint, total, orderNumber: orderNum });
      }, 1200);
      setTimeout(() => {
        setCart({});
        setPrintStatus("idle");
        setScreen("menu");
      }, 2400);
      return;
    }

    if (printer.status !== "connected") {
      setPrintStatus("not_connected");
      return;
    }

    setPrintStatus("printing");
    try {
      const bytes = buildOrderReceipt({
        restaurantName: "ABC Restaurant",
        orderNumber: orderNum,
        items: itemsToPrint,
        total,
      });
      await printer.printBytes(bytes); // resolves only once the native write() succeeds
      setPrintStatus("success");
      setLastOrder({ items: itemsToPrint, total, orderNumber: orderNum });
      setTimeout(() => {
        setCart({});
        setPrintStatus("idle");
        setScreen("menu");
      }, 1800);
    } catch (e) {
      setPrintStatus("error"); // order is kept — cart/lastOrder untouched, safe to retry
    }
  }

  function goToConnectPrinter() {
    setPrintStatus("idle");
    setScreen("settings");
  }

  function reprint() {
    if (!lastOrder) return;
    setScreen("preview");
    setPrintStatus("idle");
    setTimeout(() => handlePrint(lastOrder.items, lastOrder.total, lastOrder.orderNumber), 50);
  }

  function retryPrint() {
    handlePrint(cartItems.length ? cartItems : lastOrder.items, cartItems.length ? cartTotal : lastOrder.total, previewOrderNumber);
  }

  const previewItems = screen === "preview" && printStatus === "idle"
    ? cartItems
    : lastOrder && printStatus !== "idle" && cartCount === 0
    ? lastOrder.items
    : cartItems;
  const previewTotal = previewItems.reduce((s, i) => s + i.qty * i.price, 0);
  const previewOrderNumber = cartItems.length === 0 && lastOrder ? lastOrder.orderNumber : orderNumber;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#E7DFD3",
        display: "flex",
        justifyContent: "center",
        fontFamily: tokens.font.family,
      }}
    >
      <GlobalStyle />
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100vh",
          background: tokens.color.bg,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 0 40px rgba(0,0,0,0.12)",
        }}
      >
        {screen === "menu" && (
          <div key="menu" className="page-enter" style={{ paddingBottom: cartCount > 0 ? 110 : 24 }}>
            <RestaurantHeader
              lastOrder={lastOrder}
              onReprint={reprint}
              onOpenSettings={() => setScreen("settings")}
            />
            <SearchBar value={query} onChange={setQuery} />
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "16px 20px",
                overflowX: "auto",
              }}
              className="no-scrollbar"
            >
              {CATEGORIES.map((c) => (
                <CategoryChip
                  key={c}
                  label={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>

            {loading ? (
              <MenuSkeleton />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                query={query}
                onClear={() => {
                  setQuery("");
                  setCategory("All");
                }}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  padding: "4px 20px 8px",
                }}
              >
                {filteredItems.map((item) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    qty={cart[item.id] || 0}
                    bumped={bumpId === item.id}
                    onAdd={() => changeQty(item.id, 1)}
                    onInc={() => changeQty(item.id, 1)}
                    onDec={() => changeQty(item.id, -1)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {screen === "order" && (
          <div key="order" className="page-enter">
            <ScreenHeader title="Your Order" onBack={() => setScreen("menu")} />
            <div style={{ padding: "4px 16px 20px" }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: tokens.color.textSecondary }}>
                  <ShoppingBag size={40} color={tokens.color.textSecondary} strokeWidth={1.5} style={{ marginBottom: 10 }} />
                  <div style={{ fontWeight: 700, color: tokens.color.text }}>Your order is empty</div>
                  <div style={{ fontSize: 13.5, marginTop: 4 }}>Add items from the menu to get started.</div>
                </div>
              ) : (
                <>
                  {cartItems.map((item, idx) => (
                    <OrderItemRow
                      key={item.id}
                      item={item}
                      qty={item.qty}
                      isLast={idx === cartItems.length - 1}
                      onInc={() => changeQty(item.id, 1)}
                      onDec={() => changeQty(item.id, -1)}
                    />
                  ))}
                  <OrderSummary items={cartItems} subtotal={cartTotal} total={cartTotal} />
                  <div style={{ marginTop: 18 }}>
                    <PrimaryButton onClick={goToPreview}>Print Slip</PrimaryButton>
                    <SecondaryButton onClick={() => setScreen("menu")}>
                      Continue Ordering
                    </SecondaryButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {screen === "preview" && (
          <div key="preview" className="page-enter">
            <ScreenHeader
              title="Slip Preview"
              onBack={() =>
                printStatus === "idle" || printStatus === "error" || printStatus === "not_connected"
                  ? setScreen("order")
                  : null
              }
            />
            <div style={{ padding: "4px 16px 24px" }}>
              <SlipPreview items={previewItems} total={previewTotal} orderNumber={previewOrderNumber} />
              <div style={{ marginTop: 18 }}>
                <PrinterStatus status={printStatus} />
                {printStatus === "idle" && (
                  <>
                    <PrimaryButton
                      icon={Printer}
                      onClick={() => handlePrint(cartItems, cartTotal, previewOrderNumber)}
                    >
                      Print Slip
                    </PrimaryButton>
                    <SecondaryButton onClick={() => setScreen("order")}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={14} /> Edit Order
                      </span>
                    </SecondaryButton>
                  </>
                )}
                {printStatus === "success" && (
                  <PrimaryButton onClick={() => setScreen("menu")} style={{ background: tokens.color.success }}>
                    Done
                  </PrimaryButton>
                )}
                {printStatus === "not_connected" && (
                  <>
                    <PrimaryButton icon={Bluetooth} onClick={goToConnectPrinter}>
                      Connect Printer
                    </PrimaryButton>
                    <SecondaryButton onClick={() => setScreen("order")}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={14} /> Edit Order
                      </span>
                    </SecondaryButton>
                  </>
                )}
                {printStatus === "error" && (
                  <>
                    <PrimaryButton onClick={retryPrint}>Try Again</PrimaryButton>
                    <SecondaryButton onClick={() => setScreen("order")}>Back</SecondaryButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === "settings" && (
          <PrinterSettingsScreen printer={printer} onBack={() => setScreen("menu")} />
        )}

        {screen === "menu" && (
          <CartBar count={cartCount} total={cartTotal} onView={() => setScreen("order")} />
        )}
      </div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

      * { box-sizing: border-box; }
      body { margin: 0; }

      .btn-press:active { transform: scale(0.96); }
      .qty-btn:active { transform: scale(0.88); }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

      .page-enter {
        animation: pageIn 260ms cubic-bezier(.22,1,.36,1);
      }
      @keyframes pageIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .spin { animation: spin 900ms linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .control-pop { animation: controlPop 180ms cubic-bezier(.22,1,.36,1); }
      @keyframes controlPop {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: scale(1); }
      }

      .receipt-tear { position: relative; }
      .receipt-tear::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -9px; height: 9px;
        background:
          linear-gradient(-45deg, #FFFFFF 6px, transparent 0) 0 0/12px 12px repeat-x,
          linear-gradient(45deg, #FFFFFF 6px, transparent 0) 0 0/12px 12px repeat-x;
      }

      .shimmer-block {
        background: linear-gradient(90deg, #F1EAE0 25%, #F7F1E9 37%, #F1EAE0 63%);
        background-size: 400% 100%;
        animation: shimmer 1.4s ease infinite;
      }
      @keyframes shimmer {
        0% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      input::placeholder { color: #B8AEA2; }
    `}</style>
  );
}
