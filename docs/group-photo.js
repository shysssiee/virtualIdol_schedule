import { escape as esc } from "./calendar.js";
export function photoEditorHtml(photo) {
  return `<section class="settings-card"><h3>團體照片（4:3）</h3><label>上傳照片<input id="group-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label><canvas id="group-photo-crop" width="800" height="600" aria-label="照片裁切預覽"></canvas><div id="photo-adjust" hidden><label>放大<input id="photo-zoom" type="range" min="1" max="3" step="0.01" value="1"></label><label>左右位置<input id="photo-x" type="range" min="-1" max="1" step="0.01" value="0"></label><label>上下位置<input id="photo-y" type="range" min="-1" max="1" step="0.01" value="0"></label></div><button id="remove-group-photo" type="button">移除照片</button><p class="muted">JPEG／PNG／WebP，最多 8 MB；等比例縮放裁切為 800×600，圖片小卡顯示 160×120。調整後按表單儲存。</p><p id="photo-error" class="error" role="alert"></p></section>`;
}
export function bindPhotoEditor(root, initial) {
  let result = initial || null,
    bitmap = null,
    busy = false;
  const canvas = root.querySelector("#group-photo-crop"),
    ctx = canvas.getContext("2d"),
    adjust = root.querySelector("#photo-adjust"),
    error = root.querySelector("#photo-error");
  function draw() {
    if (!bitmap) return;
    const zoom = Number(root.querySelector("#photo-zoom").value),
      scale = Math.max(800 / bitmap.width, 600 / bitmap.height) * zoom,
      w = bitmap.width * scale,
      h = bitmap.height * scale;
    ctx.clearRect(0, 0, 800, 600);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 800, 600);
    ctx.drawImage(
      bitmap,
      (800 - w) / 2 -
        (Number(root.querySelector("#photo-x").value) * (w - 800)) / 2,
      (600 - h) / 2 -
        (Number(root.querySelector("#photo-y").value) * (h - 600)) / 2,
      w,
      h,
    );
    result = canvas.toDataURL("image/jpeg", 0.82);
    if (result.length > 580000) result = canvas.toDataURL("image/jpeg", 0.6);
    if (result.length > 580000) throw Error("照片內容過大，請選擇其他照片");
  }
  if (initial) {
    const img = new Image();
    img.onload = () => {
      if (result === initial) ctx.drawImage(img, 0, 0, 800, 600);
    };
    img.src = initial;
  }
  for (const id of ["photo-zoom", "photo-x", "photo-y"])
    root.querySelector("#" + id).oninput = () => {
      try {
        draw();
        error.textContent = "";
      } catch (e) {
        error.textContent = e.message;
      }
    };
  root.querySelector("#group-photo-file").onchange = async (event) => {
    const f = event.target.files[0];
    if (!f) return;
    busy = true;
    error.textContent = "";
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
        f.size > 8 * 1024 * 1024
      )
        throw Error("請選擇 8 MB 內的 JPEG／PNG／WebP");
      const next = await createImageBitmap(f, {
        imageOrientation: "from-image",
      });
      bitmap?.close();
      bitmap = next;
      for (const id of ["photo-zoom", "photo-x", "photo-y"])
        root.querySelector("#" + id).value = id === "photo-zoom" ? "1" : "0";
      adjust.hidden = false;
      draw();
    } catch (e) {
      error.textContent = e.message || "無法讀取照片";
    } finally {
      busy = false;
    }
  };
  root.querySelector("#remove-group-photo").onclick = () => {
    bitmap?.close();
    bitmap = null;
    result = null;
    ctx.clearRect(0, 0, 800, 600);
    adjust.hidden = true;
    error.textContent = "";
    root.querySelector("#group-photo-file").value = "";
  };
  return () => {
    if (busy) throw Error("照片處理中，請稍候");
    if (error.textContent) throw Error(error.textContent);
    return result;
  };
}
export function bindGroupPhotos(root, groups) {
  let current = null;
  let tip = document.querySelector("#group-photo-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "group-photo-tip";
    tip.hidden = true;
    document.body.append(tip);
  }
  let timer;
  const hide = () => {
    tip.hidden = true;
    current = null;
  };
  const show = (node) => {
    clearTimeout(timer);
    const g = groups.find((g) => g.id === node.dataset.photoGroup);
    if (!g?.photo_data?.startsWith("data:image/jpeg;base64,")) return;
    current = node;
    tip.innerHTML = `<img src="${esc(g.photo_data)}" alt="${esc(g.name)}"><span>${esc(g.name)}</span>`;
    tip.hidden = false;
    const r = node.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - 184, r.left)) + "px";
    tip.style.top =
      Math.max(8, r.top >= 160 ? r.top - 158 : r.bottom + 8) + "px";
  };
  root.querySelectorAll("[data-photo-group]").forEach((node) => {
    node.onmouseenter = () => {
      if (matchMedia("(hover:hover)").matches) show(node);
    };
    node.onmouseleave = () => {
      timer = setTimeout(hide, 120);
    };
    node.onfocus = () => show(node);
    node.onblur = hide;
    node.onclick = () => {
      if (!matchMedia("(hover:hover)").matches && current === node) hide();
      else show(node);
    };
    node.onkeydown = (e) => {
      if (e.key === "Escape") hide();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show(node);
      }
    };
  });
  tip.onmouseenter = () => clearTimeout(timer);
  tip.onmouseleave = hide;
  if (!tip.dataset.bound) {
    document.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("[data-photo-group],#group-photo-tip")) hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    tip.dataset.bound = "true";
  }
}
