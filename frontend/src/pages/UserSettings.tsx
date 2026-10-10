import { useEffect, useState, type FormEvent } from "react";

import "../FormLayout.css";
import "./UserSettings.css";

export default function UserSettings() {
    const [courses, setCourses] = useState<string[]>([]);
    const [courseInput, setCourseInput] = useState("");
    const [visibility, setVisibility] = useState<"public" | "private">("public");
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    useEffect(() => () => {
        if (profilePicture) URL.revokeObjectURL(profilePicture);
    }, [profilePicture]);

    function addCourse() {
        const course = courseInput.trim();
        if (course && !courses.some((item) => item.toLowerCase() === course.toLowerCase())) {
            setCourses((current) => [...current, course]);
        }
        setCourseInput("");
    }

    function submitProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Profile persistence can be connected to the account API when available.
    }

    return (
        <main className="form-page">
            <form className="form-container" onSubmit={submitProfile}>
                <header className="form-page-header">
                    <p className="form-eyebrow">Your account</p>
                    <h1>Create your profile</h1>
                    <p className="form-page-description">Introduce yourself and choose what other people can see.</p>
                </header>

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
                                <button className="form-link-button remove-picture" type="button" onClick={() => setProfilePicture(null)}>Remove picture</button>
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
                        <input id="profile-name" name="name" type="text" autoComplete="name" placeholder="Your name" required />
                    </label>
                    <label className="form-field" htmlFor="profile-email">
                        <span>Email address <span className="form-required">*</span></span>
                        <input id="profile-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
                    </label>
                    <label className="form-field" htmlFor="profile-username">
                        <span>Username <span className="form-required">*</span></span>
                        <input id="profile-username" name="username" type="text" autoComplete="username" placeholder="Choose a username" required />
                    </label>
                </section>

                <section className="form-card" aria-labelledby="about-heading">
                    <div className="form-section-header">
                        <h2 id="about-heading">About you</h2>
                    </div>
                    <label className="form-field" htmlFor="profile-description">
                        <span>Description <span className="form-optional">(optional)</span></span>
                        <textarea id="profile-description" name="description" rows={4} maxLength={300} placeholder="A little about yourself" />
                        <small>Up to 300 characters.</small>
                    </label>
                    <div className="form-field">
                        <label htmlFor="course-input">Courses you take</label>
                        <div className="form-inline-entry">
                            <input
                                id="course-input"
                                type="text"
                                value={courseInput}
                                onChange={(event) => setCourseInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addCourse();
                                    }
                                }}
                                placeholder="For example, Biology 101"
                            />
                            <button className="form-secondary-button" type="button" onClick={addCourse}>Add course</button>
                        </div>
                        <small>Add each course separately.</small>
                        {courses.length > 0 && (
                            <ul className="course-tags" aria-label="Added courses">
                                {courses.map((course) => (
                                    <li key={course}>
                                        {course}
                                        <button type="button" aria-label={`Remove ${course}`} onClick={() => setCourses((current) => current.filter((item) => item !== course))}>Remove</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="form-card" aria-labelledby="privacy-heading">
                    <div className="form-section-header">
                        <h2 id="privacy-heading">Profile visibility</h2>
                    </div>
                    <p className="form-section-description">Choose who can view your profile.</p>
                    <div className="visibility-options">
                        <label className="visibility-option">
                            <input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                            <span><strong>Public</strong><small>Other members can see your profile and courses.</small></span>
                        </label>
                        <label className="visibility-option">
                            <input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                            <span><strong>Private</strong><small>Only you can see your profile details.</small></span>
                        </label>
                    </div>
                </section>

                <button className="form-primary-button profile-submit" type="submit">Create profile</button>
            </form>
        </main>
    );
}
