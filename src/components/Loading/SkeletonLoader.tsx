import React from "react";
import { Titlebar } from "../Titlebar/Titlebar.js";
import "./SkeletonLoader.css";

export function SkeletonLoader(): React.ReactElement {
  return (
    <div className="skeleton-loader-wrap">
      <Titlebar />
      <div className="app__body">
        {/* Project Rail Skeleton */}
        <div className="project-rail skeleton-project-rail" style={{ zIndex: 80 }}>
          <div className="project-rail__list">
            <div
              className="skeleton-item skeleton-circle skeleton-shimmer"
              style={{ width: 36, height: 36, marginBottom: 8 }}
            />
            <div
              className="skeleton-item skeleton-circle skeleton-shimmer"
              style={{ width: 36, height: 36, marginBottom: 8 }}
            />
            <div
              className="skeleton-item skeleton-circle skeleton-shimmer"
              style={{ width: 36, height: 36, marginBottom: 8 }}
            />
          </div>
          <div className="project-rail__bottom">
            <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 36, height: 36 }} />
          </div>
        </div>

        {/* Session List (Sidebar) Skeleton */}
        <div className="session-list session-list--open skeleton-session-list" style={{ width: 220, minWidth: 220 }}>
          <div className="session-list__inner">
            <div className="session-list__head" style={{ borderBottom: "none" }}>
              <div style={{ marginBottom: "12px", marginTop: "4px" }}>
                {/* Name */}
                <div
                  className="skeleton-item skeleton-line skeleton-shimmer"
                  style={{ width: "60%", height: 16, marginBottom: 8 }}
                />
                {/* Path */}
                <div
                  className="skeleton-item skeleton-line skeleton-shimmer"
                  style={{ width: "85%", height: 10, opacity: 0.6 }}
                />
              </div>
              {/* New Session Button */}
              <div
                className="skeleton-item skeleton-block skeleton-shimmer"
                style={{ width: "100%", height: 28, borderRadius: 6 }}
              />
            </div>
            <div
              className="session-list__list"
              style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div
                className="skeleton-item skeleton-block skeleton-shimmer"
                style={{ width: "100%", height: 32, borderRadius: 4 }}
              />
              <div
                className="skeleton-item skeleton-block skeleton-shimmer"
                style={{ width: "100%", height: 32, borderRadius: 4 }}
              />
              <div
                className="skeleton-item skeleton-block skeleton-shimmer"
                style={{ width: "100%", height: 32, borderRadius: 4 }}
              />
              <div
                className="skeleton-item skeleton-block skeleton-shimmer"
                style={{ width: "100%", height: 32, borderRadius: 4 }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="app__content">
          <div className="layout">
            {/* Chat Panel Skeleton */}
            <div className="layout__chat" style={{ flex: 1 }}>
              <div
                className="chathistory-container"
                style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, padding: "20px 0" }}
              >
                {/* Assistant Message Skeleton */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "75%" }}>
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "40%", height: 12 }} />
                  <div
                    className="skeleton-item skeleton-block skeleton-shimmer"
                    style={{ width: "90%", height: 60, borderRadius: 8 }}
                  />
                </div>
                {/* User Message Skeleton */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    alignSelf: "flex-end",
                    width: "100%",
                  }}
                >
                  <div
                    className="skeleton-item skeleton-block skeleton-shimmer"
                    style={{ width: "50%", height: 40, borderRadius: 8, marginRight: 0 }}
                  />
                </div>
                {/* Another Assistant Message */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "75%" }}>
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "30%", height: 12 }} />
                  <div
                    className="skeleton-item skeleton-block skeleton-shimmer"
                    style={{ width: "100%", height: 80, borderRadius: 8 }}
                  />
                </div>
              </div>
              {/* Prompt Input Skeleton */}
              <div className="prompt-input-container">
                <div
                  className="skeleton-item skeleton-block skeleton-shimmer"
                  style={{ width: "100%", height: 68, borderRadius: 8 }}
                />
              </div>
            </div>

            {/* File Tree Skeleton */}
            <div
              className="sidebar"
              style={{
                width: 280,
                minWidth: 280,
                borderLeft: "1px solid var(--line)",
                borderTop: "1px solid var(--line)",
                padding: "10px",
              }}
            >
              <div className="ftree__header" style={{ padding: "0 0 10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "50%", height: 14 }} />
              </div>
              <div className="ftree__body" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "60%", height: 12 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
                  <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "70%", height: 12 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
                  <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "50%", height: 12 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
                  <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "55%", height: 12 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
