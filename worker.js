const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/order") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({ ok: false }, 405);

    let d;
    try { d = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }

    // حقل مخفي يملؤه الروبوتات فقط: نتجاهل الطلب بصمت
    if (d.website) return json({ ok: true });

    const name = String(d.name || "").trim();
    const phone = String(d.phone || "").replace(/[\s.-]/g, "");
    const address = String(d.address || "").trim();

    if (name.length < 2 || name.length > 60) return json({ ok: false, error: "name" }, 400);
    if (!/^(?:\+212|0)[5-7]\d{8}$/.test(phone)) return json({ ok: false, error: "phone" }, 400);
    if (address.length < 5 || address.length > 200) return json({ ok: false, error: "address" }, 400);

    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.8">
        <h2 style="margin:0 0 8px">طلب جديد - ROVENTA</h2>
        <p><b>الاسم:</b> ${esc(name)}<br>
        <b>الهاتف:</b> <a href="tel:${esc(phone)}">${esc(phone)}</a><br>
        <b>المدينة والعنوان:</b> ${esc(address)}<br>
        <b>المبلغ عند الاستلام:</b> 120 درهم</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "ROVENTA <onboarding@resend.dev>",
        to: [env.OWNER_EMAIL],
        subject: `طلب جديد: ${name} - ${phone}`,
        html,
      }),
    });

    if (!res.ok) return json({ ok: false, error: "mail" }, 502);
    return json({ ok: true });
  },
};
