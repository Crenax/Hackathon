import { useState, useRef, useEffect } from "react";


let courseNames = {};

fetch("/api/courses")
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => { courseNames = data; })
    .catch(error => {
        console.error("Error fetching course names:", error);
    });


const suggestions = Object.values(courseNames).map((item) => item.title);
console.log("Suggestions:", suggestions);

export default function AutocompleteInputField({expValue, expOnChange, expPlaceholder, ...props}) {
    console.log

    const [value, setValue] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const ref = useRef(null);

    const filtered = value
        ? suggestions.filter((s) =>
            s.toLowerCase().includes(value.toLowerCase())
        )
        : [];

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const select = (item) => {
        setValue(item);
        setOpen(false);
        setHighlighted(-1);
    };

    const onKeyDown = (e) => {
        if (!open || filtered.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => (h + 1) % filtered.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => (h - 1 + filtered.length) % filtered.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlighted >= 0) select(filtered[highlighted]);
        } else if (e.key === "Escape") {
            setOpen(false);
            setHighlighted(-1);
        }
    };

    return (
        <div style={{ position: "relative", width: 260 }}>
            <input
                {...props}
                value={expValue}
                onChange={expOnChange}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={expPlaceholder}
                style={{ width: "100%", padding: "8px 10px", fontSize: 14 }}
            />
            {open && filtered.length > 0 && (
                <ul
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                        background: "#fff",
                        zIndex: 10,
                        maxHeight: 180,
                        overflow: "auto",
                    }}
                >
                    {filtered.map((item, i) => (
                        <li
                            key={item}
                            onMouseDown={() => select(item)}
                            onMouseEnter={() => setHighlighted(i)}
                            style={{
                                padding: "6px 10px",
                                cursor: "pointer",
                                background: i === highlighted ? "#e8f0fe" : "transparent",
                            }}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
