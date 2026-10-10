import { useEffect, useState } from "react";
import { getMe, type User } from "../api";

export default function HomePage() {
    const [me, setMe] = useState<User | undefined>();

    useEffect(() => {
        getMe().then(setMe);
    }, []);

    return (
        <>
            <h1>Current learning sessions</h1>

            
        </>
    );
}
