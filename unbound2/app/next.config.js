console.log("✅ USING unbound2/next.config.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
turbopack: {
root: __dirname,
},
};

module.exports = nextConfig;