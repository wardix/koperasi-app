const hash = await Bun.password.hash("admin123");
console.log(hash);
const isMatch = await Bun.password.verify("admin123", hash);
console.log(isMatch);
