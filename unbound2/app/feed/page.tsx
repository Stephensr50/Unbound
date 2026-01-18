import TopNav from "../components/TopNav";

export default function FeedPage() {
return (
<>
<TopNav />

<div
style={{
width: "min(1100px, calc(100% - 32px))",
margin: "0 auto",
paddingTop: 20,
}}
>
<div
style={{
padding: 20,
borderRadius: 16,
background: "rgba(18, 18, 24, 0.70)",
border: "1px solid rgba(255, 255, 255, 0.08)",
backdropFilter: "blur(16px)",
}}
>
Feed placeholder
</div>
</div>
</>
);
}