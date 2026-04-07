export default function CS2Background() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* CS2 art background — user provides /public/cs2-bg.jpg */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: 'url(/cs2-bg.jpg)',
                    opacity: 0.08,
                }}
            />
            {/* Radial vignette — keeps edges very dark */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, #0A0A0B 70%)',
                }}
            />
            {/* Bottom fade to guarantee footer readability */}
            <div
                className="absolute bottom-0 left-0 right-0 h-48"
                style={{
                    background: 'linear-gradient(to bottom, transparent, #0A0A0B)',
                }}
            />
        </div>
    );
}
