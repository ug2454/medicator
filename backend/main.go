package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

func main() {
	var err error
	db, err = sql.Open("mysql", "admin:garlicjunior@tcp(127.0.0.1:3306)/medicator")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Test the database connection
	err = db.Ping()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Println("Successfully connected to the database")

	http.HandleFunc("/api/signup", handleSignup)
	http.HandleFunc("/api/login", handleLogin)
	http.HandleFunc("/api/home", handleHome)
	http.HandleFunc("/", serveReactApp)

	log.Println("Server started at http://localhost:8080")
	err = http.ListenAndServe(":8080", corsMiddleware(http.DefaultServeMux))
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func handleSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var user struct {
			Username        string `json:"username"`
			Email           string `json:"email"`
			Password        string `json:"password"`
			ConfirmPassword string `json:"confirmPassword"`
		}
		err := json.NewDecoder(r.Body).Decode(&user)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		if user.Password != user.ConfirmPassword {
			http.Error(w, "Passwords do not match", http.StatusBadRequest)
			return
		}

		_, err = db.Exec("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", user.Username, user.Email, user.Password)
		if err != nil {
			http.Error(w, "Failed to create user", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "Signup successful")
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var user struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		err := json.NewDecoder(r.Body).Decode(&user)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		var dbPassword string
		err = db.QueryRow("SELECT password FROM users WHERE email = ?", user.Email).Scan(&dbPassword)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "User not found", http.StatusUnauthorized)
			} else {
				http.Error(w, "Failed to query user", http.StatusInternalServerError)
			}
			return
		}
		if user.Password != dbPassword {
			http.Error(w, "Invalid password", http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "Login successful")
		http.Redirect(w, r, "/home", http.StatusSeeOther)
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./index.html")
}

func serveReactApp(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/" || strings.HasPrefix(path, "/static") {
		http.ServeFile(w, r, filepath.Join("static", "index.html"))
		return
	}

	if strings.HasPrefix(path, "/static/") {
		// Determine file extension
		ext := filepath.Ext(path)
		switch ext {
		case ".js":
			w.Header().Set("Content-Type", "application/javascript")
		case ".css":
			w.Header().Set("Content-Type", "text/css")
		case ".html":
			w.Header().Set("Content-Type", "text/html")
		default:
			w.Header().Set("Content-Type", "application/octet-stream")
		}
	}

	http.ServeFile(w, r, filepath.Join("static", path))
}