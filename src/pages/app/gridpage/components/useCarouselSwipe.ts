import { useEffect, useRef, type RefObject } from "react";

/** The drag offset goes onto the carousel as CSS variables that its slides
 * read, rather than state — no re-render per frame of finger movement. */
export function setCarouselDrag(el: HTMLElement, dy: number | null) {
	if (dy === null) {
		el.style.removeProperty("--carousel-drag");
		el.style.removeProperty("--carousel-transition");
		return;
	}
	el.style.setProperty("--carousel-drag", `${dy}px`);
	el.style.setProperty("--carousel-transition", "none");
}

/** Where the slide at `index` is drawn right now, in px from its resting
 * place — mid-animation after a swipe, it hasn't arrived yet. */
function slideOffset(el: HTMLElement, index: number): number {
	const slide = el.querySelector<HTMLElement>(`[data-carousel-slide="${index}"]`);
	if (!slide) return 0;
	const transform = getComputedStyle(slide).transform;
	if (!transform || transform === "none") return 0;
	try {
		return new DOMMatrixReadOnly(transform).m42;
	} catch {
		return 0;
	}
}

/** Vertical touch swiping through the profile photo carousel (mobile). At
 * either end the gesture is left to the page, so it scrolls normally.
 *
 * The carousel's slides place themselves with
 * `(index - var(--carousel-index)) * 100% + var(--carousel-drag)`, and the
 * carousel carries `--carousel-index` in its style: a swipe sets it here at
 * once, so the slide starts moving on release instead of after the whole
 * profile view has re-rendered. */
export function useCarouselSwipe(
	carouselRef: RefObject<HTMLDivElement | null>,
	{
		enabled,
		count,
		index,
		onIndexChange,
	}: {
		enabled: boolean;
		count: number;
		index: number;
		onIndexChange?: (index: number) => void;
	},
) {
	const lastDeltaRef = useRef(0);
	const currentIndexRef = useRef(index);
	currentIndexRef.current = index;
	const onIndexChangeRef = useRef(onIndexChange);
	onIndexChangeRef.current = onIndexChange;

	// Between the first and last photo every vertical drag is ours: the browser
	// isn't allowed to pan vertically at all. Calling preventDefault alone
	// isn't enough there — while the page still coasts from a fling (or once
	// it started scrolling), touchmove can't be cancelled, and the swipe went
	// to the page instead. At either end the page needs one direction, so
	// those keep the default and rely on preventDefault.
	useEffect(() => {
		const el = carouselRef.current;
		if (!el) return;
		el.style.touchAction = enabled && index > 0 && index < count - 1 ? "pan-x" : "";
		return () => {
			el.style.touchAction = "";
		};
	}, [carouselRef, enabled, count, index]);

	useEffect(() => {
		const el = carouselRef.current;
		if (!el || !enabled) return;

		let startY = 0, startX = 0;
		let decided = false, navigating = false;
		let baseOffset = 0;

		const ownsDirection = (dy: number) => {
			const idx = currentIndexRef.current;
			return (dy < 0 && idx < count - 1) || (dy > 0 && idx > 0);
		};

		const onStart = (e: TouchEvent) => {
			startY = e.touches[0].clientY;
			startX = e.touches[0].clientX;
			decided = false;
			navigating = false;
			lastDeltaRef.current = 0;
		};

		const onMove = (e: TouchEvent) => {
			const dy = e.touches[0].clientY - startY;
			const dx = e.touches[0].clientX - startX;

			if (!decided) {
				if (Math.abs(dy) < 8 && Math.abs(dx) < 8) {
					// Not decided yet, but already heading our way: keep the page
					// from starting to scroll — once it has, the rest of the
					// gesture can't be taken back from it.
					if (e.cancelable && Math.abs(dy) > Math.abs(dx) && ownsDirection(dy)) e.preventDefault();
					return;
				}
				decided = true;
				if (Math.abs(dx) >= Math.abs(dy)) return; // horizontal swipe → ignore
				// At either end (or when the page already owns the gesture) it's
				// left to the page, which scrolls normally.
				if (!e.cancelable || !ownsDirection(dy)) return;
				navigating = true;
				// Grabbed while the last swipe is still sliding: carry on from
				// where the photo is drawn, rather than jumping to its end.
				baseOffset = slideOffset(el, currentIndexRef.current);
			}

			if (!navigating) return;
			if (e.cancelable) e.preventDefault();
			lastDeltaRef.current = dy;
			setCarouselDrag(el, baseOffset + dy);
		};

		const onEnd = () => {
			if (!navigating) return;
			navigating = false;
			const dy = lastDeltaRef.current;
			const idx = currentIndexRef.current;
			let next = idx;
			if (dy < -60 && idx < count - 1) next = idx + 1;
			else if (dy > 60 && idx > 0) next = idx - 1;
			if (next !== idx) {
				el.style.setProperty("--carousel-index", String(next));
				currentIndexRef.current = next;
				onIndexChangeRef.current?.(next);
			}
			lastDeltaRef.current = 0;
			setCarouselDrag(el, null);
		};

		el.addEventListener("touchstart", onStart, { passive: true });
		el.addEventListener("touchmove", onMove, { passive: false });
		el.addEventListener("touchend", onEnd, { passive: true });
		el.addEventListener("touchcancel", onEnd, { passive: true });
		return () => {
			el.removeEventListener("touchcancel", onEnd);
			el.removeEventListener("touchstart", onStart);
			el.removeEventListener("touchmove", onMove);
			el.removeEventListener("touchend", onEnd);
		};
	}, [carouselRef, enabled, count]);
}
