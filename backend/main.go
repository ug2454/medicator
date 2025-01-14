package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	_ "github.com/go-sql-driver/mysql"
	"github.com/robfig/cron/v3"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
	"golang.org/x/crypto/bcrypt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var db *sql.DB

func main() {
	var err error
	config, err := loadConfig("C:\\Users\\ugarg\\OneDrive\\Documents\\MyProject\\medicator\\src\\config.json")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err = sql.Open("mysql", config.DBUsername+":"+config.DBPassword+"@tcp(127.0.0.1:3306)/medicator")

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

	// Schedule the daily task
	c := cron.New()
	c.AddFunc("@daily", checkDosagesEndingToday)
	c.Start()

	http.HandleFunc("/api/signup", handleSignup)
	http.HandleFunc("/api/login", handleLogin)
	http.HandleFunc("/api/medical-report", handleMedicalReport)
	http.HandleFunc("/api/medicine-duration", handleMedicineDuration)
	http.HandleFunc("/api/trigger-task", handleTriggerTask) // New endpoint to trigger the task
	http.HandleFunc("/api/log-bp", handleLogBP)
	http.HandleFunc("/api/get-bp-data", handleGetBPData)
	http.HandleFunc("/home", handleHome)
	http.HandleFunc("/", serveReactApp)

	log.Println("Server started at http://localhost:8080")
	err = http.ListenAndServe(":8080", corsMiddleware(http.DefaultServeMux))
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

type Config struct {
	DBUsername     string `json:"dbUsername"`
	DBPassword     string `json:"dbPassword"`
	SendGridAPIKey string `json:"sendGridAPIKey"`
}

func loadConfig(filename string) (*Config, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var config Config
	decoder := json.NewDecoder(file)
	err = decoder.Decode(&config)
	if err != nil {
		return nil, err
	}

	return &config, nil
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

	log.Println("inside handleSignup")
	if r.Method == http.MethodPost {
		var username string
		var user struct {
			Username        string `json:"username"`
			Email           string `json:"email"`
			Password        string `json:"password"`
			ConfirmPassword string `json:"confirmPassword"`
		}
		err := json.NewDecoder(r.Body).Decode(&user)
		log.Println("inside handleSignup", err)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		if user.Password != user.ConfirmPassword {
			http.Error(w, "Passwords do not match", http.StatusBadRequest)
			return
		}

		// Hash the password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password: %v", err)
			http.Error(w, "Failed to hash password", http.StatusInternalServerError)
			return
		}

		// Insert the user into the database
		_, err = db.Exec("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", user.Username, user.Email, hashedPassword)
		if err != nil {
			log.Printf("Error inserting user into database: %v", err)
			http.Error(w, "Failed to create user", http.StatusInternalServerError)
			return
		}

		var userId int
		err = db.QueryRow("SELECT id FROM users WHERE email = ?", user.Email).Scan(&userId)
		if err != nil {
			if err == sql.ErrNoRows {
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"message": "User not found"})
			} else {
				log.Printf("Failed to query user: %v", err)
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"message": "Failed to query user"})
			}
			return
		}
		w.WriteHeader(http.StatusCreated)
		username = user.Username
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Signup successful", "username": username, "userId": userId})
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

		var hashedPassword, username string
		var userId int
		err = db.QueryRow("SELECT id, password_hash, username FROM users WHERE email = ?", user.Email).Scan(&userId, &hashedPassword, &username)
		if err != nil {
			if err == sql.ErrNoRows {
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"message": "User not found"})
			} else {
				log.Printf("Failed to query user: %v", err)
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"message": "Failed to query user"})
			}
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(user.Password)); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"message": "Invalid password"})
			return
		}

		w.WriteHeader(http.StatusOK)
		log.Println("username: ", username)
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Login successful", "username": username, "userId": userId})
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}

}

func handleMedicalReport(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var report struct {
			MedicineName string `json:"medicineName"`
			Dosage       string `json:"dosage"`
			DoctorNotes  string `json:"doctorNotes"`
			FollowUpDate string `json:"followUpDate"`
			UserID       int    `json:"userId"`
		}
		err := json.NewDecoder(r.Body).Decode(&report)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		_, err = db.Exec("INSERT INTO medical_reports (medicine_name, dosage, doctor_notes, follow_up_date, user_id) VALUES (?, ?, ?, ?, ?)",
			report.MedicineName, report.Dosage, report.DoctorNotes, report.FollowUpDate, report.UserID)
		if err != nil {
			http.Error(w, "Failed to save medical report", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "Medical report saved successfully"})
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleMedicineDuration(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {

		userIDStr := r.URL.Query().Get("user_id")
		if userIDStr == "" {
			http.Error(w, "Missing user_id parameter", http.StatusBadRequest)
			return
		}

		userID, err := strconv.Atoi(userIDStr)
		if err != nil {
			http.Error(w, "Invalid user_id parameter", http.StatusBadRequest)
			return
		}
		rows, err := db.Query("SELECT medicine_name, dosage, follow_up_date FROM medical_reports where user_id=?", userID)
		if err != nil {
			http.Error(w, "Failed to fetch medical reports", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var reports []struct {
			MedicineName string `json:"medicineName"`
			Dosage       string `json:"dosage"`
			FollowUpDate string `json:"followUpDate"`
		}

		for rows.Next() {
			var report struct {
				MedicineName string `json:"medicineName"`
				Dosage       string `json:"dosage"`
				FollowUpDate string `json:"followUpDate"`
			}
			if err := rows.Scan(&report.MedicineName, &report.Dosage, &report.FollowUpDate); err != nil {
				http.Error(w, "Failed to scan medical report", http.StatusInternalServerError)
				return
			}
			reports = append(reports, report)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Failed to fetch medical reports", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(reports)
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/home.html")
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

func checkDosagesEndingToday() {
	today := time.Now().Format("2006-01-02")
	rows, err := db.Query("SELECT u.email, u.username, m.medicine_name FROM medical_reports m JOIN users u ON m.user_id = u.id WHERE m.dosage = ?", today)
	if err != nil {
		log.Printf("Failed to fetch dosages ending today: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var email, username, medicineName string
		if err := rows.Scan(&email, &username, &medicineName); err != nil {
			log.Printf("Failed to scan dosage ending today: %v", err)
			continue
		}
		sendEmail(email, medicineName, username)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Failed to fetch dosages ending today: %v", err)
	}
}

func sendEmail(to, medicineName string, username string) {
	config, err := loadConfig("C:\\Users\\ugarg\\OneDrive\\Documents\\MyProject\\medicator\\src\\config.json")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	from := mail.NewEmail("Medicator", "u.garg14@gmail.com")
	subject := "Dosage End Reminder"
	toEmail := mail.NewEmail(username, to)
	plainTextContent := fmt.Sprintf("This is the last day of the dosage for %s. Please follow up with your doctor to renew the medicine or stop.", medicineName)
	htmlContent := fmt.Sprintf("<p>This is the last day of the dosage for <strong>%s</strong>. Please follow up with your doctor to renew the medicine or stop.</p>", medicineName)
	message := mail.NewSingleEmail(from, subject, toEmail, plainTextContent, htmlContent)

	client := sendgrid.NewSendClient(config.SendGridAPIKey)
	response, err := client.Send(message)
	if err != nil {
		log.Printf("Failed to send email to %s: %v", to, err)
	} else {
		log.Printf("Email sent to %s with status code %d", to, response.StatusCode)
		log.Printf("Response Body: %s", response.Body)
		log.Printf("Response Headers: %v", response.Headers)
	}
}

func handleTriggerTask(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		checkDosagesEndingToday()
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Task triggered successfully"})
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleLogBP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var bpData struct {
		Systolic  int    `json:"systolic"`
		Diastolic int    `json:"diastolic"`
		Pulse     int    `json:"pulse"`
		Time      string `json:"time"`
		UserID    int    `json:"userId"`
	}
	err := json.NewDecoder(r.Body).Decode(&bpData)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("INSERT INTO blood_pressure (systolic, diastolic, pulse, time, user_id) VALUES (?, ?, ?, ?, ?)", bpData.Systolic, bpData.Diastolic, bpData.Pulse, bpData.Time, bpData.UserID)
	if err != nil {
		log.Printf("Error inserting BP data into database: %v", err)
		http.Error(w, "Failed to log BP data", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "BP logged successfully!"})
}

func handleGetBPData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "Missing user_id parameter", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user_id parameter", http.StatusBadRequest)
		return
	}

	rows, err := db.Query("SELECT systolic, diastolic, pulse, time, created_at FROM blood_pressure WHERE user_id = ? ORDER BY time", userID)
    if err != nil {
        log.Printf("Error querying BP data: %v", err)
        http.Error(w, "Failed to fetch BP data", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

	var bpData []struct {
        Systolic   int    `json:"systolic"`
        Diastolic  int    `json:"diastolic"`
        Pulse      int    `json:"pulse"`
        Time       string `json:"time"`
        CreatedAt  string `json:"created_at"`
    }

    for rows.Next() {
        var entry struct {
            Systolic   int    `json:"systolic"`
            Diastolic  int    `json:"diastolic"`
            Pulse      int    `json:"pulse"`
            Time       string `json:"time"`
            CreatedAt  string `json:"created_at"`
        }
        if err := rows.Scan(&entry.Systolic, &entry.Diastolic, &entry.Pulse, &entry.Time, &entry.CreatedAt); err != nil {
            log.Printf("Error scanning BP data: %v", err)
            continue
        }
        bpData = append(bpData, entry)
    }

    if err := rows.Err(); err != nil {
        log.Printf("Error iterating BP data rows: %v", err)
        http.Error(w, "Failed to fetch BP data", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(bpData)
}
