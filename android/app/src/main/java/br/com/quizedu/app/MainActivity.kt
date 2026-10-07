@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package br.com.quizedu.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels

class MainActivity : ComponentActivity() {
    private val quiz: QuizViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) intent?.dataString?.let(quiz::acceptLink)
        setContent { QuizEduTheme { QuizEduApp(quiz) } }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent); setIntent(intent)
        intent.dataString?.let(quiz::acceptLink)
    }
}
