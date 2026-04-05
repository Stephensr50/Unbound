"use client";

import { useEffect, useRef } from "react";
import twemoji from "twemoji";

export default function Twemoji({
children,
}: {
children: React.ReactNode;
}) {
const ref = useRef<HTMLSpanElement>(null);

useEffect(() => {
if (ref.current) {
twemoji.parse(ref.current, {
folder: "svg",
ext: ".svg",
});
}
}, [children]);

return <span ref={ref}>{children}</span>;
}