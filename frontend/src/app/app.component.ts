import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LayoutComponent } from "./layout/layout.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  title = "AutoMed Frontend";
}
