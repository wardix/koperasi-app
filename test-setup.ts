process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-123";
process.env.DATABASE_URL = "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_test";

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
