package auth

import (
	"testing"
	"time"
)

func TestHashAndCheckPassword(t *testing.T) {
	hash, err := HashPassword("s3cret-password")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !CheckPassword(hash, "s3cret-password") {
		t.Fatal("expected correct password to verify")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Fatal("expected wrong password to fail verification")
	}
}

func TestIssueAndParseAccessToken(t *testing.T) {
	a := New("test-secret-at-least-16-bytes")
	claims := Claims{UserID: "u1", Email: "a@example.com", Role: "librarian", FullName: "Thu Thu"}

	tok, err := a.IssueAccessToken(claims)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	got, err := a.ParseAccessToken(tok)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if got != claims {
		t.Fatalf("claims mismatch: got %+v want %+v", got, claims)
	}

	// A refresh token must not be accepted where an access token is expected.
	refresh, err := a.IssueRefreshToken(claims)
	if err != nil {
		t.Fatalf("IssueRefreshToken: %v", err)
	}
	if _, err := a.ParseAccessToken(refresh); err != ErrWrongTokenType {
		t.Fatalf("expected ErrWrongTokenType, got %v", err)
	}
	if _, err := a.ParseRefreshToken(tok); err != ErrWrongTokenType {
		t.Fatalf("expected ErrWrongTokenType, got %v", err)
	}
}

func TestParseAccessToken_WrongSecret(t *testing.T) {
	a := New("test-secret-at-least-16-bytes")
	b := New("different-secret-16-bytes-long")
	tok, err := a.IssueAccessToken(Claims{UserID: "u1", Role: "admin"})
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	if _, err := b.ParseAccessToken(tok); err == nil {
		t.Fatal("expected error parsing token signed with a different secret")
	}
}

func TestAccessTokenExpiry(t *testing.T) {
	if AccessTokenTTL != 15*time.Minute {
		t.Fatalf("expected 15 minute access token TTL, got %v", AccessTokenTTL)
	}
	if RefreshTokenTTL != 7*24*time.Hour {
		t.Fatalf("expected 7 day refresh token TTL, got %v", RefreshTokenTTL)
	}
}
