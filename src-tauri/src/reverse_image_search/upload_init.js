// Evaluated as an expression by reverse_image_search/mod.rs: `(<this>)(config)`.
// Feeds the photo handed over by the app into the page's upload input.
(config) => {
	"use strict";

	if (window.top !== window) return;

	const onEngine = location.hostname === config.host || location.hostname.endsWith(`.${config.host}`);

	// Mobile: the window has no chrome to close it.
	const CLOSE_ID = "__free-grind-close";
	const addCloseButton = () => {
		if (!config.closeButton || !document.body || document.getElementById(CLOSE_ID)) return;
		const button = document.createElement("button");
		button.id = CLOSE_ID;
		button.type = "button";
		button.textContent = "✕";
		button.setAttribute("aria-label", "Close");
		button.setAttribute(
			"style",
			"position:fixed;z-index:2147483647;top:max(8px,env(safe-area-inset-top));right:12px;" +
				"width:36px;height:36px;padding:0;border:0;border-radius:999px;background:rgba(0,0,0,.7);" +
				"color:#fff;font:600 16px -apple-system,system-ui,sans-serif;",
		);
		button.addEventListener("click", () => location.assign(config.closeUrl));
		document.body.appendChild(button);
	};
	if (document.body) addCloseButton();
	else document.addEventListener("DOMContentLoaded", addCloseButton);

	if (!onEngine) return;

	const makeFile = () => {
		const binary = atob(config.image);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return new File([bytes], config.fileName, { type: config.mimeType, lastModified: Date.now() });
	};

	const isFileInput = (el) => el instanceof HTMLInputElement && el.type === "file";

	let handedOver = false;
	const feed = (input) => {
		try {
			handedOver = true;
			const transfer = new DataTransfer();
			transfer.items.add(makeFile());
			input.files = transfer.files;
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
			return true;
		} catch (error) {
			handedOver = false;
			console.warn("[free-grind] could not hand over the photo", error);
			return false;
		}
	};

	// Whenever the page asks for a file (user click or the page's own
	// input.click()/showPicker()), answer with the photo instead of a picker.
	const nativeClick = HTMLInputElement.prototype.click;
	HTMLInputElement.prototype.click = function (...args) {
		if (isFileInput(this) && feed(this)) return;
		return nativeClick.apply(this, args);
	};
	const nativeShowPicker = HTMLInputElement.prototype.showPicker;
	if (nativeShowPicker) {
		HTMLInputElement.prototype.showPicker = function (...args) {
			if (isFileInput(this) && feed(this)) return;
			return nativeShowPicker.apply(this, args);
		};
	}
	document.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			const input = isFileInput(target)
				? target
				: target instanceof Element && target.closest("label")?.control;
			if (isFileInput(input) && feed(input)) event.preventDefault();
		},
		true,
	);

	// One automatic attempt per window: open the upload dialog, which then
	// asks for a file and gets the photo through the hooks above.
	const AUTO_KEY = `__free_grind_upload_${config.nonce}`;
	try {
		if (sessionStorage.getItem(AUTO_KEY)) return;
	} catch {}
	const markDone = () => {
		try {
			sessionStorage.setItem(AUTO_KEY, "1");
		} catch {}
	};

	const UPLOAD_TEXT = /upload/i;
	const findUploadTrigger = () => {
		for (const el of document.querySelectorAll("button, [role=button], label, a")) {
			if (el.id === CLOSE_ID) continue;
			const text = `${el.textContent || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
			if (UPLOAD_TEXT.test(text) || el.querySelector("input[type=file]")) return el;
		}
		return null;
	};

	let clickedTrigger = false;
	const attempt = () => {
		// The trigger's own input.click() already got the photo.
		if (handedOver) return true;
		const inputs = [...document.querySelectorAll("input[type=file]")];
		const input = inputs.find((i) => /image/.test(i.accept || "")) || inputs[0];
		// A visible drop zone with its input already mounted: feed it directly.
		if (input && clickedTrigger && feed(input)) return true;
		if (!clickedTrigger) {
			const trigger = findUploadTrigger();
			if (trigger) {
				clickedTrigger = true;
				trigger.click();
			}
		}
		return false;
	};

	const start = () => {
		const deadline = Date.now() + 20000;
		const tick = () => {
			if (attempt()) return markDone();
			if (Date.now() > deadline) return markDone();
			setTimeout(tick, 400);
		};
		tick();
	};
	if (document.readyState === "complete") start();
	else window.addEventListener("load", start, { once: true });
}
