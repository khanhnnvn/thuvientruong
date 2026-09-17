// Package auth provides password hashing and JWT issuance/verification for
// the library system. Access tokens are short-lived (15 minutes) and carry
// the caller's role so handlers can authorize without a database round trip;
// refresh tokens (7 days) are stored client-side in an HttpOnly cookie.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 7 * 24 * time.Hour

	issuer = "thuvientruong"

	typAccess  = "access"
	typRefresh = "refresh"
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrWrongTokenType = errors.New("wrong token type")
)

// Claims is what every issued token carries about its owner. SchoolID is nil
// for super_admin (a system-wide account with no tenant) and set to the
// owning school's id for every other role.
type Claims struct {
	UserID   string  `json:"uid"`
	Email    string  `json:"email"`
	Role     string  `json:"role"`
	FullName string  `json:"name"`
	SchoolID *string `json:"school_id,omitempty"`
}

type tokenClaims struct {
	jwt.RegisteredClaims
	Claims
	Typ string `json:"typ"`
}

type Auth struct {
	key []byte
}

func New(secret string) *Auth {
	return &Auth{key: []byte(secret)}
}

func (a *Auth) issue(c Claims, typ string, ttl time.Duration) (string, error) {
	now := time.Now()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, tokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   c.UserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
		Claims: c,
		Typ:    typ,
	})
	return tok.SignedString(a.key)
}

func (a *Auth) IssueAccessToken(c Claims) (string, error) {
	return a.issue(c, typAccess, AccessTokenTTL)
}

func (a *Auth) IssueRefreshToken(c Claims) (string, error) {
	return a.issue(c, typRefresh, RefreshTokenTTL)
}

func (a *Auth) parse(token, wantTyp string) (Claims, error) {
	var claims tokenClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return a.key, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(issuer), jwt.WithExpirationRequired())
	if err != nil {
		return Claims{}, ErrInvalidToken
	}
	if claims.Typ != wantTyp {
		return Claims{}, ErrWrongTokenType
	}
	return claims.Claims, nil
}

func (a *Auth) ParseAccessToken(token string) (Claims, error)  { return a.parse(token, typAccess) }
func (a *Auth) ParseRefreshToken(token string) (Claims, error) { return a.parse(token, typRefresh) }

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equaliser"), bcrypt.DefaultCost)

// BurnPasswordCheck costs the same as a real check so unknown emails can't be
// distinguished from wrong passwords by timing.
func BurnPasswordCheck(password string) {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}
