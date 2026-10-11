import { Link } from "react-router-dom";

import "./UserLink.css";

interface UserLinkProps {
    userId: string;
    name: string;
}

// A user's name that opens their public profile
export default function UserLink({ userId, name }: UserLinkProps) {
    return (
        <Link className="user-link" to={`/user?id=${encodeURIComponent(userId)}`} title="Show profile">
            {name.trim() || "Name unavailable"}
        </Link>
    );
}
