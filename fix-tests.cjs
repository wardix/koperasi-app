const fs = require('fs');
let code = fs.readFileSync('server/index.test.ts', 'utf8');

// Fix GET /api/v1/stats
code = code.replace(/const body = await res\.json\(\);/g, "const body = (await res.json()).data || await res.json();");

// Fix PUT /api/v1/members/:id/savings
code = code.replace(/const saveBody = await saveRes\.json\(\);/g, "const saveBody = (await saveRes.json()).data;");

// Fix GET /api/v1/loans/:id/payments
code = code.replace(/const getBody = await getRes\.json\(\);/g, "const getBody = (await getRes.json()).data;");

// Fix GET /api/v1/shu
code = code.replace(/const body = \(await res\.json\(\)\) as any;\s+expect\(body\.year\)/g, "const body = (await res.json()).data as any;\n    expect(body.year)");

// Fix POST /api/v1/refresh
code = code.replace(/expect\(body\.token\)\.toBeDefined\(\);/g, "expect(body.data.token).toBeDefined();");

// Fix GET /api/v1/stats caching
code = code.replace(/const body3 = \(await res3\.json\(\)\) as any;/g, "const body3 = (await res3.json()).data as any;");

// Let's just do a generic replacement for body = await res.json(); to const raw = await res.json(); const body = raw.data ? raw.data : raw; where possible. Actually, simpler:
code = code.replace(/const body = await res\.json\(\);/g, "const raw = await res.json(); const body = raw.data || raw;");

fs.writeFileSync('server/index.test.ts', code);
