import { useEffect, useState, type FormEvent } from "react";
import { XCircle } from "react-bootstrap-icons";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Gender, getMe, isProfileComplete, updateMe } from "../api";
import "../FormLayout.css";
import AutocompleteInputField from "../components/AutocompleteInputField";
import "./UserSettings.css";

const GENDER_LABELS: Record<Gender, string> = {
    [Gender.preferNotToSay]: "Prefer not to say",
    [Gender.male]: "Male",
    [Gender.female]: "Female",
    [Gender.nonBinary]: "Non-binary",
};

function todayAsDateInput(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function UserSettings() {
    const [courseInput, setCourseInput] = useState("");
    const [visibility, setVisibility] = useState<"public" | "private">("public");
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    // Saved through PATCH /api/me
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState<Gender | "">("");
    const [description, setDescription] = useState("");
    const [isComplete, setIsComplete] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Set when another page sent the user here because the profile was incomplete
    const cameFromIncompleteRedirect = searchParams.get("incomplete") === "1";

    useEffect(() => {
        let isActive = true;
        getMe()
            .then((me) => {
                if (!isActive) return;
                setFullName(me.fullName);
                setEmail(me.emailAddress);
                setDateOfBirth(me.dateOfBirth ?? "");
                setGender(me.gender ?? "");
                setDescription(me.description);
                setIsComplete(isProfileComplete(me));
            })
            .catch((error: unknown) => {
                if (isActive) setErrorMessage(error instanceof Error ? error.message : "Could not load your profile.");
            })
            .finally(() => {
                if (isActive) setIsLoading(false);
            });
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => () => {
        if (profilePicture) URL.revokeObjectURL(profilePicture);
    }, [profilePicture]);

    async function submitProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatusMessage("");
        setErrorMessage("");
        setIsSaving(true);
        try {
            // Picture, username, courses and visibility have no backend fields yet and are not sent
            const saved = await updateMe({
                fullName: fullName.trim(),
                dateOfBirth: dateOfBirth || null,
                gender: gender || null,
                description: description.trim(),
            });
            const complete = isProfileComplete(saved);
            setIsComplete(complete);
            if (complete && cameFromIncompleteRedirect) {
                navigate("/", { replace: true });
                return;
            }
            setStatusMessage("Profile saved.");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Could not save your profile.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <main className="form-page">
            <form className="form-container" onSubmit={submitProfile}>
                <header className="form-page-header">
                    <p className="form-eyebrow">Your account</p>
                    <h1>{isComplete ? "Your profile" : "Create your profile"}</h1>
                    <p className="form-page-description">Introduce yourself and choose what other people can see.</p>
                </header>

                {!isLoading && (!isComplete || cameFromIncompleteRedirect) && (
                    <p className="form-card profile-notice" role="status">
                        Please complete your profile to use the app. Date of birth and full name are required.
                    </p>
                )}

                <section className="form-card" aria-labelledby="picture-heading">
                    <div className="form-section-header">
                        <h2 id="picture-heading">Profile picture</h2>
                    </div>
                    <div className="picture-picker">
                        {profilePicture ? (
                            <img className="picture-preview" src={profilePicture} alt="Profile preview" />
                        ) : (
                            <div className="picture-placeholder" aria-hidden="true">Add photo</div>
                        )}
                        <div className="picture-controls">
                            <label className="form-secondary-button picture-upload">
                                <span>{profilePicture ? "Change picture" : "Choose picture"}</span>
                                <input
                                    type="file"
                                    name="profilePicture"
                                    accept="image/*"
                                    onChange={(event) => {
                                        const file = event.currentTarget.files?.[0];
                                        if (file) setProfilePicture(URL.createObjectURL(file));
                                    }}
                                />
                            </label>
                            {profilePicture && (
                                <button className="form-link-button remove-picture" type="button" onClick={() => setProfilePicture(null)} aria-label="Remove picture">
                                    <XCircle aria-hidden="true" />
                                </button>
                            )}
                            <small>Choose an image from your device.</small>
                        </div>
                    </div>
                </section>

                <section className="form-card" aria-labelledby="personal-heading">
                    <div className="form-section-header">
                        <h2 id="personal-heading">Personal information</h2>
                    </div>
                    <label className="form-field" htmlFor="profile-name">
                        <span>Full name <span className="form-required">*</span></span>
                        <input id="profile-name" name="name" type="text" autoComplete="name" placeholder="Your name" required
                            value={fullName} onChange={(event) => setFullName(event.target.value)} />
                    </label>
                    <label className="form-field" htmlFor="profile-email">
                        <span>Email address</span>
                        <input id="profile-email" name="email" type="email" value={email} readOnly />
                        <small>From your ETH login, can't be changed here.</small>
                    </label>
                    <label className="form-field" htmlFor="profile-username">
                        <span>Username <span className="form-optional">(optional)</span></span>
                        <input id="profile-username" name="username" type="text" autoComplete="username" placeholder="Choose a username" />
                    </label>
                    <label className="form-field" htmlFor="profile-gender">
                        <span>Gender <span className="form-optional">(optional)</span></span>
                        <select id="profile-gender" name="gender" value={gender}
                            onChange={(event) => setGender(event.target.value as Gender | "")}>
                            <option value="">Not specified</option>
                            {Object.values(Gender).map((value) => (
                                <option key={value} value={value}>{GENDER_LABELS[value]}</option>
                            ))}
                        </select>
                    </label>
                    <label className="form-field" htmlFor="profile-birth-date">
                        <span>Date of birth <span className="form-required">*</span></span>
                        <input id="profile-birth-date" name="dateOfBirth" type="date" required max={todayAsDateInput()}
                            value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                    </label>
                    <label className="form-field" htmlFor="profile-description">
                        <span>About you<span className="form-optional">(optional)</span></span>
                        <textarea id="profile-description" name="description" rows={4} maxLength={300} placeholder="Degree, major, etc."
                            value={description} onChange={(event) => setDescription(event.target.value)} />
                        <small>Up to 300 characters.</small>
                    </label>
                </section>

                {errorMessage && <p className="profile-message profile-message--error" role="alert">{errorMessage}</p>}
                {statusMessage && <p className="profile-message" role="status">{statusMessage}</p>}
                <button className="form-primary-button profile-submit" type="submit" disabled={isLoading || isSaving}>
                    {isSaving ? "Saving…" : "Save profile"}
                </button>
            </form>
        </main>
    );
}
