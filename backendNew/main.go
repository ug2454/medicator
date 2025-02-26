package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	_ "github.com/go-sql-driver/mysql"
	"github.com/robfig/cron/v3"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey = []byte("c01bdd29189dcdef4f1e9f104704520fc2646e5b0d075070e538c95ab773dbdcafbfcfae24fe0d39ac3b8f2352c3b2372971f96bc3be986c1cf30cd0af55ccfa9c2aa41e3dd1fe6d53b7425ac3c6ea37220a14650ed100ec9017b58041f09181931509390ed3f86b93df2fd385d0b559f059d8ad00cbef44dbcadc9de1a2b72f6ea42ea95300ca13c5bb03fd4d6e311cced92be7cd61eae9b7a74a9c196e1bce635285108db6a1f64c31650c2e45ac5f50d75552ffc4ef9e440646fd68a9a107f5724ea600e9241509d0227bc94cec4a8ce7d6b3c3e1de6552f5b315df6e268b09baf92b720ba354705debb10bfeab65c4f3c39452884a4784bc99e1bff455ee")

// var jwtKey = []byte(os.Getenv("JWT_SECRET_KEY"))
type Claims struct {
	Username string `json:"username"`
	jwt.StandardClaims
}

var db *sql.DB

func main() {
	var err error

	//   // Load configuration from environment variables
	//   dbHost := os.Getenv("DB_HOST")
	//   dbPort := os.Getenv("DB_PORT")
	//   dbName := os.Getenv("DB_NAME")
	//   dbUser := os.Getenv("DB_USER")
	//   dbPass := os.Getenv("DB_PASS")

	// Load configuration from environment variables
	dbHost := "127.0.0.1"
	dbPort := "3306"
	dbName := "medicator"
	dbUser := "admin"
	dbPass := "garlicjunior"

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?timeout=30s", dbUser, dbPass, dbHost, dbPort, dbName)
	log.Printf("Connecting to database: %s@tcp(%s:%s)/%s", dbUser, dbHost, dbPort, dbName)
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	defer db.Close()

	// Test the database connection
	err = db.Ping()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Println("Successfully connected to the database")

	// Schedule the daily tasks for IST (UTC+5:30)
	istLocation := time.FixedZone("IST", 5*60*60+30*60) // IST is UTC+5:30
	c := cron.New(cron.WithLocation(istLocation))

	// Check for dosages ending today
	_, err = c.AddFunc("0 0 * * *", func() {
		log.Println("Running scheduled task: checkDosagesEndingToday")
		checkDosagesEndingToday()
	})
	if err != nil {
		log.Fatalf("Failed to schedule task: %v", err)
	}

	// Add new task to check for upcoming dosages
	_, err = c.AddFunc("0 0 * * *", func() {
		log.Println("Running scheduled task: checkUpcomingDosages")
		checkUpcomingDosages()
	})
	if err != nil {
		log.Fatalf("Failed to schedule task: %v", err)
	}

	c.Start()
	// Start the HTTP server
	http.HandleFunc("/api/signup", handleSignup)
	http.HandleFunc("/api/login", handleLogin)

	// Protected routes
	protected := http.NewServeMux()
	protected.HandleFunc("/api/medical-report", handleMedicalReport)
	protected.HandleFunc("/api/medicine-duration", handleMedicineDuration)
	protected.HandleFunc("/api/medicine-duration/", handleMedicineDuration) // Note the trailing slash
	protected.HandleFunc("/api/trigger-task", handleTriggerTask)            // New endpoint to trigger the task
	protected.HandleFunc("/api/log-bp", handleLogBP)
	protected.HandleFunc("/api/get-bp-data", handleGetBPData)
	protected.HandleFunc("/api/timezone", handleTimezone) // New endpoint to check timezone
	protected.HandleFunc("/home", handleHome)
	// Apply the JWT middleware
	http.Handle("/api/", jwtMiddleware(protected))
	http.HandleFunc("/", serveReactApp)

	port := "8080"
	log.Println("Server started at http://localhost:8080")
	err = http.ListenAndServe(":"+port, corsMiddleware(http.DefaultServeMux))
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

type Config struct {
	DBUsername     string `json:"dbUsername"`
	DBPassword     string `json:"dbPassword"`
	SendGridAPIKey string `json:"sendGridAPIKey"`
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

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
		// Generate JWT token
		expirationTime := time.Now().Add(24 * time.Hour)
		claims := &Claims{
			Username: user.Username,
			StandardClaims: jwt.StandardClaims{
				ExpiresAt: expirationTime.Unix(),
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtKey)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// Return the token in the response body
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":  "Signup successful",
			"username": user.Username,
			"userId":   userId,
			"token":    tokenString,
		})
	} else {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	log.Println("Login request received")
	if r.Method == http.MethodPost {
		var user struct {
			Email    string `json:"email"`
			Password string `json:"password"` // This is now pre-hashed from frontend
		}
		err := json.NewDecoder(r.Body).Decode(&user)
		if err != nil {
			log.Printf("Error decoding request body: %v", err)
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		var hashedPassword, username string
		var userId int
		err = db.QueryRow("SELECT id, password_hash, username FROM users WHERE email = ?", user.Email).Scan(&userId, &hashedPassword, &username)
		if err != nil {
			if err == sql.ErrNoRows {
				log.Printf("User not found: %s", user.Email)
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

		// Generate JWT token
		expirationTime := time.Now().Add(24 * time.Hour)
		claims := &Claims{
			Username: username,
			StandardClaims: jwt.StandardClaims{
				ExpiresAt: expirationTime.Unix(),
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtKey)
		if err != nil {
			log.Printf("Failed to generate token: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to generate token"})
			return
		}
		log.Printf("Token generated successfully for user: %s", username)

		log.Printf("LOGIN SUCCESSFUL - UserID: %d, Username: %s", userId, username)

		w.WriteHeader(http.StatusOK)
		// Return the token in the response body
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":  "Login successful",
			"username": username,
			"userId":   userId,
			"token":    tokenString,
		})

	} else {
		log.Printf("Invalid request method: %s", r.Method)
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func handleMedicalReport(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var report struct {
			MedicineName  string `json:"medicineName"`
			Dosage        string `json:"dosage"`
			DoctorNotes   string `json:"doctorNotes"`
			FollowUpDate  string `json:"followUpDate"`
			UserID        int    `json:"userId"`
			FrequencyType string `json:"frequencyType"`
			WeeklyDay     string `json:"weeklyDay"`
			DurationValue int    `json:"durationValue"`
			DurationUnit  string `json:"durationUnit"`
			EndDate       string `json:"endDate"`
		}
		err := json.NewDecoder(r.Body).Decode(&report)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		_, err = db.Exec("INSERT INTO medical_reports (medicine_name, dosage, doctor_notes, follow_up_date, user_id, frequency_type, weekly_day, duration_value, duration_unit, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			report.MedicineName, report.Dosage, report.DoctorNotes, report.FollowUpDate, report.UserID,
			report.FrequencyType, report.WeeklyDay, report.DurationValue, report.DurationUnit, report.EndDate)
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
	log.Printf("Received request: %s %s", r.Method, r.URL.Path)

	// Handle DELETE requests
	if r.Method == http.MethodDelete {
		// Extract the report ID from the URL
		parts := strings.Split(r.URL.Path, "/")
		log.Printf("Path parts: %v", parts)

		if len(parts) < 4 {
			log.Printf("Invalid path format: %s", r.URL.Path)
			http.Error(w, "Invalid request path", http.StatusBadRequest)
			return
		}

		reportID := parts[3]
		log.Printf("Attempting to delete report with ID: %s", reportID)

		// Delete the report from the database
		result, err := db.Exec("DELETE FROM medical_reports WHERE id = ?", reportID)
		if err != nil {
			log.Printf("Error deleting report: %v", err)
			http.Error(w, "Failed to delete report", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			log.Printf("Error checking rows affected: %v", err)
			http.Error(w, "Error checking deletion result", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			log.Printf("No report found with ID: %s", reportID)
			http.Error(w, "Report not found", http.StatusNotFound)
			return
		}

		log.Printf("Successfully deleted report with ID: %s", reportID)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Medical report deleted successfully"})
		return
	}

	// Handle GET requests
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

		// Make sure to include all the necessary fields in the query
		rows, err := db.Query("SELECT id, medicine_name, dosage, follow_up_date, end_date, frequency_type, weekly_day, duration_value, duration_unit FROM medical_reports WHERE user_id = ?", userID)
		if err != nil {
			http.Error(w, "Failed to fetch medical reports", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var reports []struct {
			ID            int    `json:"id"`
			MedicineName  string `json:"medicineName"`
			Dosage        string `json:"dosage"`
			FollowUpDate  string `json:"followUpDate"`
			EndDate       string `json:"end_date"`
			FrequencyType string `json:"frequencyType"`
			WeeklyDay     string `json:"weeklyDay"`
			DurationValue int    `json:"durationValue"`
			DurationUnit  string `json:"durationUnit"`
		}

		for rows.Next() {
			var report struct {
				ID            int    `json:"id"`
				MedicineName  string `json:"medicineName"`
				Dosage        string `json:"dosage"`
				FollowUpDate  string `json:"followUpDate"`
				EndDate       string `json:"end_date"`
				FrequencyType string `json:"frequencyType"`
				WeeklyDay     string `json:"weeklyDay"`
				DurationValue int    `json:"durationValue"`
				DurationUnit  string `json:"durationUnit"`
			}
			// Make sure to scan all fields
			if err := rows.Scan(&report.ID, &report.MedicineName, &report.Dosage, &report.FollowUpDate, &report.EndDate, &report.FrequencyType, &report.WeeklyDay, &report.DurationValue, &report.DurationUnit); err != nil {
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
		// If we get here, the method is not supported
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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
	// Set the IST timezone
	istLocation := time.FixedZone("IST", 5*60*60+30*60) // IST is UTC+5:30

	// Get the current date in IST
	today := time.Now().In(istLocation).Format("2006-01-02")

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
	sendGridAPIKey := "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"

	from := mail.NewEmail("Medicator", "u.garg14@gmail.com")
	subject := "Dosage End Reminder"
	toEmail := mail.NewEmail(username, to)
	plainTextContent := fmt.Sprintf("This is the last day of the dosage for %s. Please follow up with your doctor to renew the medicine or stop.", medicineName)
	htmlContent := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
			<h2 style="color: #4a4a4a;">Dosage End Reminder</h2>
			<p>Hello %s,</p>
			<p>This is to inform you that today is the <strong>last day</strong> of your prescribed dosage for <strong>%s</strong>.</p>
			<p>Please follow up with your doctor to determine if you should:</p>
			<ul>
				<li>Renew your prescription</li>
				<li>Stop taking the medication</li>
				<li>Adjust your dosage</li>
			</ul>
			<p style="margin-top: 30px;">Best regards,<br>The Medicator Team</p>
		</div>
	`, username, medicineName)

	message := mail.NewSingleEmail(from, subject, toEmail, plainTextContent, htmlContent)

	client := sendgrid.NewSendClient(sendGridAPIKey)
	response, err := client.Send(message)
	if err != nil {
		log.Printf("Failed to send email to %s: %v", to, err)
	} else {
		log.Printf("Email sent to %s with status code %d", to, response.StatusCode)
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
		Systolic  int    `json:"systolic"`
		Diastolic int    `json:"diastolic"`
		Pulse     int    `json:"pulse"`
		Time      string `json:"time"`
		CreatedAt string `json:"created_at"`
	}

	for rows.Next() {
		var entry struct {
			Systolic  int    `json:"systolic"`
			Diastolic int    `json:"diastolic"`
			Pulse     int    `json:"pulse"`
			Time      string `json:"time"`
			CreatedAt string `json:"created_at"`
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

func handleTimezone(w http.ResponseWriter, r *http.Request) {
	currentTime := time.Now()
	timezone, offset := currentTime.Zone()
	response := map[string]interface{}{
		"current_time": currentTime.Format(time.RFC3339),
		"timezone":     timezone,
		"offset":       offset,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})
		if err != nil {
			if err == jwt.ErrSignatureInvalid {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if !token.Valid {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// Add the username to the request context
		ctx := context.WithValue(r.Context(), "username", claims.Username)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// New function to check for upcoming dosages and send reminders
func checkUpcomingDosages() {
	// Set the IST timezone
	istLocation := time.FixedZone("IST", 5*60*60+30*60) // IST is UTC+5:30

	// Get today's date in IST (instead of tomorrow)
	today := time.Now().In(istLocation).Format("2006-01-02")

	// Get today's weekday (0 = Sunday, 1 = Monday, etc.)
	todayWeekday := time.Now().In(istLocation).Weekday()

	// Map of weekday names to their number representation
	weekdayMap := map[string]int{
		"sunday":    0,
		"monday":    1,
		"tuesday":   2,
		"wednesday": 3,
		"thursday":  4,
		"friday":    5,
		"saturday":  6,
	}

	// For weekly medications, we need to check if today is the right day of the week
	// and if the medication has started but not ended
	weeklyRows, err := db.Query(`
		SELECT u.email, u.username, m.medicine_name, m.weekly_day 
		FROM medical_reports m 
		JOIN users u ON m.user_id = u.id 
		WHERE m.frequency_type = 'weekly' 
		AND m.dosage <= ? 
		AND m.end_date >= ?`,
		today, today)

	if err != nil {
		log.Printf("Failed to fetch upcoming weekly dosages: %v", err)
		return
	}
	defer weeklyRows.Close()

	for weeklyRows.Next() {
		var email, username, medicineName, weeklyDay string
		if err := weeklyRows.Scan(&email, &username, &medicineName, &weeklyDay); err != nil {
			log.Printf("Failed to scan upcoming weekly dosage: %v", err)
			continue
		}

		// Convert weeklyDay to lowercase for case-insensitive comparison
		weeklyDayLower := strings.ToLower(weeklyDay)

		// Check if today matches the weekly dosage day
		if targetDay, ok := weekdayMap[weeklyDayLower]; ok {
			if int(todayWeekday) == targetDay {
				log.Printf("Sending reminder for weekly medication %s to %s for today (%s)",
					medicineName, email, today)
				sendDosageReminderEmail(email, medicineName, username, today)
			}
		}
	}

	// For daily medications, we just need to check if the medication has started but not ended
	dailyRows, err := db.Query(`
		SELECT u.email, u.username, m.medicine_name 
		FROM medical_reports m 
		JOIN users u ON m.user_id = u.id 
		WHERE m.frequency_type = 'daily' 
		AND m.dosage <= ? 
		AND m.end_date >= ?`,
		today, today)

	if err != nil {
		log.Printf("Failed to fetch upcoming daily dosages: %v", err)
		return
	}
	defer dailyRows.Close()

	for dailyRows.Next() {
		var email, username, medicineName string
		if err := dailyRows.Scan(&email, &username, &medicineName); err != nil {
			log.Printf("Failed to scan upcoming daily dosage: %v", err)
			continue
		}

		log.Printf("Sending reminder for daily medication %s to %s for today (%s)",
			medicineName, email, today)
		sendDosageReminderEmail(email, medicineName, username, today)
	}

	log.Printf("Completed checking for upcoming dosages for %s", today)
}

// New function to send dosage reminder emails
func sendDosageReminderEmail(to, medicineName, username, dosageDate string) {
	sendGridAPIKey := "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"

	from := mail.NewEmail("Medicator", "u.garg14@gmail.com")
	subject := "Medication Reminder"
	toEmail := mail.NewEmail(username, to)

	// Format the date for display
	formattedDate, err := time.Parse("2006-01-02", dosageDate)
	dateStr := dosageDate
	if err == nil {
		dateStr = formattedDate.Format("Monday, January 2, 2006")
	}

	plainTextContent := fmt.Sprintf("Reminder: You have a dosage of %s scheduled for today (%s). Please don't forget to take your medication.", medicineName, dateStr)
	htmlContent := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
			<h2 style="color: #4a4a4a;">Medication Reminder</h2>
			<p>Hello %s,</p>
			<p>This is a friendly reminder that you have a dosage of <strong>%s</strong> scheduled for today (%s).</p>
			<p>Please don't forget to take your medication as prescribed by your doctor.</p>
			<p style="margin-top: 30px;">Best regards,<br>The Medicator Team</p>
		</div>
	`, username, medicineName, dateStr)

	message := mail.NewSingleEmail(from, subject, toEmail, plainTextContent, htmlContent)

	client := sendgrid.NewSendClient(sendGridAPIKey)
	response, err := client.Send(message)
	if err != nil {
		log.Printf("Failed to send dosage reminder email to %s: %v", to, err)
	} else {
		log.Printf("Dosage reminder email sent to %s with status code %d", to, response.StatusCode)
	}
}
