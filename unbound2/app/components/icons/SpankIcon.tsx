export default function SpankIcon({ size = 20 }) {
return (
<svg viewBox="0 0 100 90" width={size} height={size} fill="none">
<path
d="
M50 78
C22 56, 8 44, 8 28
C8 14, 19 10, 29 18
C34 10, 41 11, 46 18

L28 8
L35 18
L65 18
L72 8

C59 11, 66 10, 71 18
C81 10, 92 14, 92 28
C92 44, 78 56, 50 78
Z
"
stroke="currentColor"
strokeWidth="5"
strokeLinecap="square"
strokeLinejoin="miter"
strokeMiterlimit="6"
/>
</svg>
);
}