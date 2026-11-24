import { afterEach, expect, mock, test } from "bun:test";
import { openOfficialRegistration } from "../src/services/officialRegistration";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
	if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function setNativeWindow(value: object) {
	Object.defineProperty(globalThis, "window", { configurable: true, value });
}

test("opens the installed app without passing account data", () => {
	const openOfficialGrindr = mock(() => true);
	setNativeWindow({ FreeGrindBridge: { openOfficialGrindr } });

	expect(openOfficialRegistration()).toBe(true);
	expect(openOfficialGrindr.mock.calls).toEqual([[]]);
});

test("reports a failed launch", () => {
	setNativeWindow({ FreeGrindBridge: { openOfficialGrindr: () => false } });
	expect(openOfficialRegistration()).toBe(false);
});

test("handles a browser without the Android bridge", () => {
	setNativeWindow({});
	expect(openOfficialRegistration()).toBe(false);
});
