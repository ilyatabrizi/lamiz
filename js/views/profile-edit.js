// Edit profile. Saved as you type — there is no Save button to forget. A photo framed
// in a circle and kept on this phone only; a birthday in the Iranian calendar, because
// a birthday drink is given on 12 Mehr, not on 4 October.

import { icon } from "../icons.js";
import { esc } from "../util.js";
import { MONTHS, MONTHS_FA, monthLength, toJalali } from "../jalali.js";
import { profile, setProfile, photo, setPhoto, fullName, myHue, shownName } from "../store.js";
import * as presence from "../presence.js";
import { avatarHTML, actionSheet, toast } from "../ui.js";
import { choosePhoto } from "../photo.js";
import { back } from "../router.js";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s) => String(s || "").replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
/** Iranian mobiles: 09xx xxx xxxx, with or without +98. */
export const mobileOK = (s) => /^(?:\+98|0098|0)?9\d{9}$/.test(latin(s).replace(/[\s\-()]/g, ""));
const emailOK = (s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export default function profileEdit() {
  const p = profile();
  const thisYear = toJalali(new Date()).jy;
  const years = []; for (let y = thisYear - 12; y >= thisYear - 90; y--) years.push(y);
  const b = p.bday || {};
  const days = (jm, jy) => monthLength(jy || 1400, jm || 1);

  const html = `
    <div class="wrap">
      <div class="lt-wrap"><h1 class="lt">Edit profile</h1><p class="lt-sub">Kept on this phone. Saved as you type.</p></div>
      <div class="photo-edit" id="face">${avatarHTML({ name: fullName() || "", photo: photo(), hue: myHue(), size: 104 })}
        <button type="button" id="photo" aria-label="Change photo">${icon("camera")}</button></div>
      <div class="form">
        <div class="form-2">
          <div class="field"><label for="f-first">First name</label><input id="f-first" autocomplete="given-name" value="${esc(p.first)}" maxlength="30"></div>
          <div class="field"><label for="f-last">Last name</label><input id="f-last" autocomplete="family-name" value="${esc(p.last)}" maxlength="40"></div>
        </div>
        <div class="field"><label for="f-phone">Mobile</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0912 345 6789" value="${esc(p.phone)}" maxlength="16"><span class="err" id="e-phone" hidden>That doesn't look like an Iranian mobile — 11 digits, starting 09.</span></div>
        <div class="field"><label for="f-email">Email <span style="font-weight:500">(optional)</span></label><input id="f-email" type="email" inputmode="email" autocomplete="email" value="${esc(p.email)}" maxlength="80"><span class="err" id="e-email" hidden>Check the email address.</span></div>
        <div class="field"><label>Birthday</label>
          <div class="bday">
            <select id="f-d" aria-label="Day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${b.jd === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
            <select id="f-m" aria-label="Month"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${b.jm === i + 1 ? "selected" : ""}>${m} — ${MONTHS_FA[i]}</option>`).join("")}</select>
            <select id="f-y" aria-label="Year"><option value="">Year</option>${years.map((y) => `<option value="${y}" ${b.jy === y ? "selected" : ""}>${y}</option>`).join("")}</select>
          </div>
          <span class="hint">In the Iranian calendar. Roast and Black members get a drink on the day.</span></div>
        <button class="btn btn--ink btn--block" type="button" id="done">Done</button>
      </div>
    </div>`;

  function mount(screen) {
    const $ = (s) => screen.querySelector(s);
    const face = () => { $("#face").firstElementChild.outerHTML = avatarHTML({ name: fullName() || "", photo: photo(), hue: myHue(), size: 104 }); };
    const sync = () => presence.rename(shownName(), myHue(), profile().appear === "hidden" ? "" : photo());
    const onName = () => { setProfile({ first: $("#f-first").value.trim(), last: $("#f-last").value.trim() }); face(); sync(); };
    $("#f-first").addEventListener("input", onName);
    $("#f-last").addEventListener("input", onName);
    $("#f-phone").addEventListener("input", (e) => {
      const v = e.target.value.trim();
      $("#e-phone").hidden = !v || mobileOK(v);
      if (!v || mobileOK(v)) setProfile({ phone: latin(v) });
    });
    $("#f-email").addEventListener("input", (e) => {
      const v = e.target.value.trim();
      $("#e-email").hidden = emailOK(v);
      if (emailOK(v)) setProfile({ email: v });
    });
    const onDay = () => {
      const jd = +$("#f-d").value, jm = +$("#f-m").value, jy = +$("#f-y").value;
      // the day list follows the month: Esfand has 29 days, 30 in a leap year
      if (jm) {
        const max = days(jm, jy);
        [...$("#f-d").options].forEach((o) => { if (o.value) o.disabled = +o.value > max; });
        if (jd > max) $("#f-d").value = String(max);
      }
      const d2 = +$("#f-d").value;
      setProfile({ bday: d2 && jm && jy ? { jy, jm, jd: d2 } : null });
    };
    ["#f-d", "#f-m", "#f-y"].forEach((s) => $(s).addEventListener("change", onDay));
    $("#photo").addEventListener("click", () => actionSheet({
      title: "Profile photo", sub: "It stays on this phone. In a check-in room others see it only if you show your name.",
      actions: [
        { label: "Take a photo", ico: "camera", run: () => choosePhoto({ camera: true, onDone: (url) => { if (setPhoto(url)) { face(); sync(); toast("Photo saved"); } else toast("This phone is out of room for a photo"); } }) },
        { label: "Choose from library", ico: "image", run: () => choosePhoto({ onDone: (url) => { if (setPhoto(url)) { face(); sync(); toast("Photo saved"); } else toast("This phone is out of room for a photo"); } }) },
        ...(photo() ? [{ label: "Remove photo", ico: "trash", danger: true, run: () => { setPhoto(""); face(); sync(); } }] : []),
      ],
    }));
    $("#done").addEventListener("click", () => { toast("Saved"); back(); });
  }

  return { html, mount, cls: "pad-top" };
}
