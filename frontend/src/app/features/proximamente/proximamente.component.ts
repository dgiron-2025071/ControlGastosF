import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-proximamente",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./proximamente.component.html",
  styleUrl: "./proximamente.component.css",
})
export class ProximamenteComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  get user() {
    return this.authService.currentUser();
  }

  goBack(): void {
    this.router.navigate(["/dashboard"]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/login"], { replaceUrl: true });
  }
}
