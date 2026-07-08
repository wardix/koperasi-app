process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-123";
process.env.DATABASE_PATH = "koperasi_test.sqlite";

(globalThis as any).NativeRequest = Request;
(globalThis as any).NativeHeaders = Headers;

import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt) => {
    return {
        ...originalGetComputedStyle(elt),
        border: '',
        getPropertyValue: () => ''
    } as any;
};

class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserver;
window.matchMedia = window.matchMedia || function() {
    return { matches: false, addListener: function() {}, removeListener: function() {} };
};
