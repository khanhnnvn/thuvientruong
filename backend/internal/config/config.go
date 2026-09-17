// Package config reads process configuration from environment variables.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

type Config struct {
	Env         string
	HTTPAddr    string
	DatabaseURL string
	JWTSecret   string
	CORSOrigin  string
}

const devSecret = "dev-only-secret-do-not-use-in-production-0123456789"

func (c Config) Production() bool { return c.Env == "production" }

// Load reads configuration from the environment, applying sane defaults for
// local development. JWT_SECRET must be supplied outside of development/test.
func Load() (Config, error) {
	c := Config{
		Env:         get("APP_ENV", "development"),
		HTTPAddr:    get("HTTP_ADDR", ":8190"),
		DatabaseURL: get("DATABASE_URL", "postgres://localhost:5432/thuvien?sslmode=disable"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		CORSOrigin:  get("CORS_ORIGIN", "http://localhost:3400"),
	}

	if c.JWTSecret == "" {
		if c.Env != "development" && c.Env != "test" {
			return c, fmt.Errorf("JWT_SECRET is required unless APP_ENV=development (got %q)", c.Env)
		}
		slog.Warn("JWT_SECRET not set, using insecure development secret", "env", c.Env)
		c.JWTSecret = devSecret
	}
	if len(c.JWTSecret) < 16 {
		return c, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	return c, nil
}

func get(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

// AccessTokenTTLMinutes and RefreshTokenTTLDays are fixed by the API contract
// but exposed here in case an operator needs to read them via env in future.
func getInt(key string, def int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
